import { IRouter } from 'src/core/server';
import { schema } from '@osd/config-schema';
import { extractProcessInfo } from '../utils/extractProcessInfo';

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

export function registerProcessesRoute(router: IRouter) {
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
