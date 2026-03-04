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

export function registerAgentsRoute(router: IRouter) {
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
}
