import { DynamicStructuredTool, tool } from '@langchain/core/tools'
import TrutoApi from '@truto/truto-ts-sdk'
import {
  compact,
  each,
  filter,
  get,
  keys,
  map,
  pick,
  snakeCase,
} from 'lodash-es'
import pluralize from 'pluralize'

export const isCustomMethod = (method: string) => {
  return ['get', 'list', 'create', 'update', 'delete'].indexOf(method) === -1
}

export const isIndividualMethod = (method: string) => {
  return ['get', 'update', 'delete'].indexOf(method) !== -1
}

export const getRequiredProperties = (schema: Record<string, any>) => {
  return filter(
    map(schema, (value, key) => (value.required ? key : null)),
    value => value !== null
  )
}

export const getPropertiesBySchema = (
  body: Record<string, any>,
  schema: Record<string, any>
) => {
  const keysToPick = keys(schema)
  return pick(body, keysToPick)
}

export const getToolName = (
  integrationLabel: string,
  resourceName: string,
  methodName: string
) => {
  if (methodName === 'list') {
    return snakeCase(`list all ${integrationLabel} ${resourceName}`)
  }
  if (methodName === 'get') {
    return snakeCase(
      `get single ${integrationLabel} ${pluralize.singular(resourceName)} by id`
    )
  }
  if (methodName === 'create') {
    return snakeCase(
      `create a ${integrationLabel} ${pluralize.singular(resourceName)}`
    )
  }
  if (methodName === 'update') {
    return snakeCase(
      `update a ${integrationLabel} ${pluralize.singular(resourceName)} by id`
    )
  }
  if (methodName === 'delete') {
    return snakeCase(
      `delete a ${integrationLabel} ${pluralize.singular(resourceName)} by id`
    )
  }
  return snakeCase(`${integrationLabel} ${resourceName} ${methodName}`)
}

export async function getTools(
  integratedAccountId: string,
  config: {
    truto: {
      baseUrl?: string
      token: string
    }
  }
): Promise<Record<string, DynamicStructuredTool<Record<string, any>>>> {
  const tools: Record<string, DynamicStructuredTool<Record<string, any>>> = {}

  const trutoApi = new TrutoApi({
    baseUrl: config.truto.baseUrl,
    token: config.truto.token,
  })

  const integratedAccount = await trutoApi.integratedAccount.get(
    integratedAccountId
  )

  const installedIntegration = await trutoApi.environmentIntegration.get(
    integratedAccount.environment_integration_id
  )

  const integration = get(installedIntegration, 'integration') || {}

  const resources = get(integration, 'config.resources', []) as Record<
    string,
    any
  >

  each(resources, (resource: any, resourceName: string) => {
    each(resource, (method, methodName: string) => {
      const description = get(method, 'description') || ''
      if (!description) {
        return
      }
      const toolName = getToolName(
        integration.name || '',
        resourceName,
        methodName
      )
      const querySchema = get(method, 'query_schema') || {}
      if (methodName === 'list') {
        querySchema.limit = {
          type: 'string',
          description: 'The number of records to fetch',
        }
        querySchema.next_cursor = {
          type: 'string',
          description:
            'The cursor to fetch the next set of records. This can be found in the response of the previous call as nextCursor.',
        }
      }
      const queryRequiredProperties = getRequiredProperties(querySchema)
      const bodySchema = get(method, 'body_schema') || {}
      const bodyRequiredProperties = getRequiredProperties(bodySchema)
      tools[toolName] = tool<Record<string, any>>(
        async config => {
          const methodToCall = isCustomMethod(methodName)
            ? 'customMethod'
            : methodName
          const query = getPropertiesBySchema(config, querySchema) || {}
          const body = getPropertiesBySchema(config, bodySchema) || {}
          switch (methodToCall) {
            case 'list':
              return JSON.stringify(
                await trutoApi.proxyApi
                  .list({
                    integrated_account_id: integratedAccountId,
                    resource: resourceName,
                    ...query,
                  })
                  .next(),
                null,
                2
              )
            case 'get':
              return JSON.stringify(
                await trutoApi.proxyApi.get(config?.id, {
                  integrated_account_id: integratedAccountId,
                  resource: resourceName,
                  ...query,
                }),
                null,
                2
              )
            case 'create':
              return JSON.stringify(
                await trutoApi.proxyApi.create(body, {
                  integrated_account_id: integratedAccountId,
                  resource: resourceName,
                  ...query,
                }),
                null,
                2
              )
            case 'update':
              return JSON.stringify(
                await trutoApi.proxyApi.update(config?.id, body, {
                  integrated_account_id: integratedAccountId,
                  resource: resourceName,
                  ...query,
                }),
                null,
                2
              )
            case 'delete':
              return JSON.stringify(
                await trutoApi.proxyApi.delete(config?.id, {
                  integrated_account_id: integratedAccountId,
                  resource: resourceName,
                  ...query,
                }),
                null,
                2
              )
            case 'customMethod':
              return JSON.stringify(
                await trutoApi.proxyApi.customMethod(methodName, body, {
                  integrated_account_id: integratedAccountId,
                  resource: resourceName,
                  ...query,
                }),
                null,
                2
              )
          }
          return []
        },
        {
          name: toolName,
          description: get(method, 'description') || '',
          schema: {
            type: 'object',
            properties: {
              ...querySchema,
              ...bodySchema,
              ...(isIndividualMethod(methodName)
                ? {
                    id: {
                      type: 'string',
                      description: `The id of the ${resourceName} to ${methodName}. Required.`,
                    },
                  }
                : {}),
            },
            required: compact([
              isIndividualMethod(methodName) ? 'id' : null,
              ...queryRequiredProperties,
              ...bodyRequiredProperties,
            ]),
          },
        }
      )
      console.log(
        'Registering tool',
        JSON.stringify(
          {
            name: toolName,
            description: get(method, 'description') || '',
            schema: {
              type: 'object',
              properties: {
                ...querySchema,
                ...bodySchema,
                ...(isIndividualMethod(methodName)
                  ? {
                      id: {
                        type: 'string',
                        description: `The id of the ${resourceName} to ${methodName}. Required.`,
                      },
                    }
                  : {}),
              },
              required: compact([
                isIndividualMethod(methodName) ? 'id' : null,
                ...queryRequiredProperties,
                ...bodyRequiredProperties,
              ]),
            },
          },
          null,
          2
        )
      )
    })
  })

  return tools
}

export default getTools
