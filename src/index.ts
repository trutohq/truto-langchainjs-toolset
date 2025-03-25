import { DynamicStructuredTool, tool } from '@langchain/core/tools'
import TrutoApi from '@truto/truto-ts-sdk'
import { each, keys, pick } from 'lodash-es'

export const getPropertiesBySchema = (
  body: Record<string, any>,
  schema: Record<string, any>
) => {
  const keysToPick = keys(schema?.properties || {})
  return pick(body, keysToPick)
}

export async function getTools(
  integratedAccountId: string,
  config: {
    methods?: string[]
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

  const availableTools = await trutoApi.integratedAccount.tools(
    integratedAccountId,
    config?.methods
  )

  each(availableTools, availableTool => {
    const toolName = availableTool.name
    tools[toolName] = tool<Record<string, any>>(
      async config => {
        const resourceName = availableTool.resource
        const methodToCall = availableTool.method
        const query =
          getPropertiesBySchema(config, availableTool.query_schema) || {}
        const body =
          getPropertiesBySchema(config, availableTool.body_schema) || {}
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
          default:
            return JSON.stringify(
              await trutoApi.proxyApi.customMethod(methodToCall, body, {
                integrated_account_id: integratedAccountId,
                resource: resourceName,
                ...query,
              }),
              null,
              2
            )
        }
      },
      {
        name: toolName,
        description: availableTool.description || '',
        schema: {
          type: 'object',
          properties: {
            ...(availableTool.query_schema?.properties || {}),
            ...(availableTool.body_schema?.properties || {}),
          },
          required: availableTool.required || [],
        },
      }
    )
    console.log('Registered tool', toolName, {
      name: toolName,
      description: availableTool.description || '',
      schema: {
        type: 'object',
        properties: {
          ...(availableTool.query_schema?.properties || {}),
          ...(availableTool.body_schema?.properties || {}),
        },
        required: availableTool.required || [],
      },
    })
  })

  return tools
}

export default getTools
