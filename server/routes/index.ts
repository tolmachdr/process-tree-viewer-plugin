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
        console.log('Loading agents for index:', request.params.index);

        const possibleFields = [
          'agent.id.keyword',
          'agent.id',
          'agent_id',
        ];

        let result;
        let successField = null;

        for (const field of possibleFields) {
          try {
            result = await context.core.opensearch.client.asCurrentUser.search({
              index: request.params.index,
              body: {
                size: 0,
                query: {
                  bool: {
                    must: [
                      {
                        range: {
                          '@timestamp': {
                            gte: 'now-7d',
                          },
                        },
                      },
                      {
                        exists: {
                          field: 'agent.id',
                        },
                      },
                    ],
                  },
                },
                aggs: {
                  agents: {
                    terms: {
                      field: field,
                      size: 1000,
                    },
                    aggs: {
                      agent_names: {
                        terms: {
                          field: 'agent.name.keyword',
                          size: 1,
                        },
                      },
                    },
                  },
                },
              },
            });

            const responseBody = result.body as AggregationResponse;
            if (responseBody.aggregations?.agents?.buckets && 
                responseBody.aggregations.agents.buckets.length > 0) {
              successField = field;
              console.log('Successfully used field:', field);
              break;
            }
          } catch (err) {
            console.log('Failed with field:', field);
            continue;
          }
        }

        if (!result || !successField) {
          console.log('Aggregation failed, using search method');
          
          const searchResult = await context.core.opensearch.client.asCurrentUser.search({
            index: request.params.index,
            body: {
              size: 1000,
              query: {
                bool: {
                  must: [
                    {
                      range: {
                        '@timestamp': {
                          gte: 'now-7d',
                        },
                      },
                    },
                    {
                      exists: {
                        field: 'agent.id',
                      },
                    },
                  ],
                },
              },
              _source: ['agent.id', 'agent.name'],
              collapse: {
                field: 'agent.id.keyword',
              },
            },
          });

          const agentsMap = new Map<string, { id: string; name: string; count: number }>();
          
          const hits = (searchResult.body as SearchResponse).hits.hits;
          hits.forEach((hit: any) => {
            const agentId = hit._source?.agent?.id;
            const agentName = hit._source?.agent?.name;
            
            if (agentId) {
              if (!agentsMap.has(agentId)) {
                agentsMap.set(agentId, {
                  id: agentId,
                  name: agentName || agentId,
                  count: 1,
                });
              } else {
                const agent = agentsMap.get(agentId)!;
                agent.count++;
              }
            }
          });

          const agents = Array.from(agentsMap.values());
          console.log('Found agents via search:', agents);

          return response.ok({
            body: {
              success: true,
              agents: agents,
            },
          });
        }

        const responseBody = result.body as AggregationResponse;
        const buckets = responseBody.aggregations?.agents?.buckets || [];

        console.log('Found buckets:', buckets.length);

        const agents = buckets.map((bucket) => ({
          id: bucket.key,
          name: bucket.agent_names?.buckets?.[0]?.key || bucket.key,
          count: bucket.doc_count,
        }));

        console.log('Processed agents:', agents);

        return response.ok({
          body: {
            success: true,
            agents: agents,
          },
        });
      } catch (error: any) {
        console.error('Error loading agents:', error);
        return response.ok({
          body: {
            success: true,
            agents: [],
            error: error.message,
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
          offset: schema.number({ defaultValue: 0 }),
          agentIds: schema.maybe(schema.arrayOf(schema.string())),
        }),
      },
    },
    async (context, request, response) => {
      try {
        const { index, timeRange, limit, offset, agentIds } = request.body;

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

        if (agentIds && agentIds.length > 0) {
          baseQuery.bool.must.push({
            terms: { 'agent.id': agentIds },
          });
        }

        const result = (await context.core.opensearch.client.asCurrentUser.search({
          index: index,
          body: {
            query: baseQuery,
            size: limit,
            from: offset,
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
              source_index: hit._index,
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
        console.error('Error loading processes:', error);
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
    
    let fullCommand = audit.command;
    if (audit.execve) {
      const args: string[] = [];
      const argc = parseInt(audit.execve.argc || '0');
      
      for (let i = 0; i < argc; i++) {
        const argKey = `a${i}`;
        if (audit.execve[argKey]) {
          args.push(audit.execve[argKey]);
        }
      }
      
      if (args.length > 0) {
        fullCommand = args.join(' ');
      }
    }
    
    return {
      pid: parseInt(audit.pid) || 0,
      ppid: parseInt(audit.ppid) || 0,
      name: audit.exe ? audit.exe.split('/').pop() : audit.command?.split(' ')[0] || 'unknown',
      exe: audit.exe,
      command: fullCommand || audit.command,
      cwd: audit.cwd,
      uid: parseInt(audit.uid) || 0,
      gid: parseInt(audit.gid) || 0,
      type: 'audit',
      execve: audit.execve,
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
