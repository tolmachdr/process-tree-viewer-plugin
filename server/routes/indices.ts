import { IRouter } from 'src/core/server';
import { schema } from '@osd/config-schema';

interface CatIndicesResponse {
  body: Array<{
    index: string;
    health: string;
    status: string;
    'docs.count': string;
    'store.size': string;
  }>;
}

export function registerIndicesRoute(router: IRouter) {
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
}
