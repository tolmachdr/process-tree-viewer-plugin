import { IRouter } from 'src/core/server';
import { schema } from '@osd/config-schema';

interface AggregationBucket {
  key: string;
  doc_count: number;
  agent_names?: {
    buckets?: Array<{ key: string }>;
  };
}

interface AggregationResponse {
  aggregations?: {
    agents?: {
      buckets?: AggregationBucket[];
    };
  };
}

interface SearchResponse {
  hits: {
    hits: Array<{
      _id: string;
      _index: string;
      _score: number;
      _source: any;
    }>;
    total: {
      value: number;
    };
  };
  took: number;
  aggregations?: any;
}

interface CatIndicesResponse {
  body: Array<{
    index: string;
    health: string;
    status: string;
    'docs.count': string;
    'store.size': string;
  }>;
}

export function defineRoutes(router: IRouter) {
  router.get(
    {
      path: '/api/process_tree/indices',
      validate: {
        query: schema.object({
          pattern: schema.string({ defaultValue: '*' }),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const result = (await context.core.opensearch.client.asCurrentUser.cat.indices({
          format: 'json',
          index: request.query.pattern,
          h: ['index', 'health', 'status', 'docs.count', 'store.size'],
        })) as CatIndicesResponse;

        const filteredIndices = result.body.filter(
          (index) =>
            !index.index.startsWith('.') &&
            !index.index.includes('security-auditlog') &&
            !index.index.includes('top_queries')
        );

        return response.ok({
          body: {
            success: true,
            indices: filteredIndices,
          },
        });
      } catch (error: any) {
        return response.badRequest({
          body: {
            message: error.message,
          },
        });
      }
    }
  );

  router.get(
    {
      path: '/api/process_tree/agents/{index}',
      validate: {
        params: schema.object({
          index: schema.string(),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const result = (await context.core.opensearch.client.asCurrentUser.search({
          index: request.params.index,
          body: {
            size: 0,
            aggs: {
              agents: {
                terms: {
                  field: 'agent.id',
                  size: 100,
                },
                aggs: {
                  agent_names: {
                    terms: {
                      field: 'agent.name',
                      size: 1,
                    },
                  },
                },
              },
            },
          },
        })) as { body: AggregationResponse };

        const responseBody = result.body as AggregationResponse;
        const buckets = responseBody.aggregations?.agents?.buckets || [];

        const agents = buckets.map((bucket) => ({
          id: bucket.key,
          name: bucket.agent_names?.buckets?.[0]?.key || bucket.key,
          count: bucket.doc_count,
        }));

        return response.ok({
          body: {
            success: true,
            agents: agents,
          },
        });
      } catch (error: any) {
        return response.badRequest({
          body: {
            message: error.message,
          },
        });
      }
    }
  );

  router.post(
    {
      path: '/api/process_tree/processes',
      validate: {
        body: schema.object({
          index: schema.string(),
          timeRange: schema.object({
            from: schema.string(),
            to: schema.string(),
          }),
          limit: schema.number({ defaultValue: 1000 }),
          agentId: schema.maybe(schema.string()),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const { index, timeRange, limit, agentId } = request.body;

        const baseQuery: any = {
          bool: {
            must: [
              {
                range: {
                  '@timestamp': {
                    gte: timeRange.from,
                    lte: timeRange.to,
                  },
                },
              },
              {
                bool: {
                  should: [
                    { exists: { field: 'data.audit.pid' } },
                    { exists: { field: 'data.win.eventdata.processId' } },
                    { exists: { field: 'data.sysmon.ProcessId' } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
          },
        };

        if (agentId) {
          baseQuery.bool.must.push({
            term: { 'agent.id': agentId },
          });
        }

        const result = (await context.core.opensearch.client.asCurrentUser.search({
          index: index,
          body: {
            query: baseQuery,
            size: limit,
            sort: [{ '@timestamp': { order: 'desc' } }],
          },
        })) as { body: SearchResponse };

        const processes = result.body.hits.hits
          .map((hit) => {
            const source = hit._source;

            let processInfo = extractProcessInfo(source);

            return {
              ...processInfo,
              _id: hit._id,
              _index: hit._index,
              _score: hit._score,
              timestamp: source['@timestamp'],
              agent: source.agent,
              rule: source.rule,
              rawData: source,
            };
          })
          .filter((p: any) => p.pid && p.pid > 0);

        return response.ok({
          body: {
            success: true,
            processes: processes,
            total: result.body.hits.total.value,
            took: result.body.took,
          },
        });
      } catch (error: any) {
        return response.badRequest({
          body: {
            message: error.message,
          },
        });
      }
    }
  );
}

function extractProcessInfo(source: any): any {
  if (source.data?.audit) {
    const audit = source.data.audit;
    return {
      pid: parseInt(audit.pid) || 0,
      ppid: parseInt(audit.ppid) || 0,
      name: audit.exe ? audit.exe.split('/').pop() : audit.command?.split(' ')[0] || 'unknown',
      exe: audit.exe,
      command: audit.command,
      cwd: audit.cwd,
      uid: parseInt(audit.uid) || 0,
      gid: parseInt(audit.gid) || 0,
      type: 'audit',
    };
  }

  if (source.data?.win?.eventdata) {
    const eventdata = source.data.win.eventdata;
    return {
      pid: parseInt(eventdata.processId) || 0,
      ppid: parseInt(eventdata.parentProcessId) || 0,
      name: eventdata.processName || eventdata.image || 'unknown',
      exe: eventdata.image,
      command: eventdata.commandLine,
      cwd: eventdata.currentDirectory,
      type: 'windows',
    };
  }

  if (source.data?.sysmon) {
    const sysmon = source.data.sysmon;
    return {
      pid: parseInt(sysmon.ProcessId) || 0,
      ppid: parseInt(sysmon.ParentProcessId) || 0,
      name: sysmon.ProcessName || sysmon.Image || 'unknown',
      exe: sysmon.Image,
      command: sysmon.CommandLine,
      cwd: sysmon.CurrentDirectory,
      type: 'sysmon',
    };
  }

  return {
    pid: parseInt(source.pid) || parseInt(source.processId) || 0,
    ppid: parseInt(source.ppid) || parseInt(source.parentProcessId) || 0,
    name: source.processName || source.exe?.split('/').pop() || 'unknown',
    exe: source.exe,
    command: source.commandLine || source.command,
    cwd: source.cwd,
    type: 'generic',
  };
}
