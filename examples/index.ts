import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { isEmpty, values } from 'lodash-es'
import { ToolCall } from '@langchain/core/dist/messages/tool'
import { getTools } from '../src'

// Make sure to set the OPENAI_API_KEY environment variable
const llm = new ChatOpenAI({
  model: 'o3-mini',
})

const INTEGRATED_ACCOUNT_ID = '08b28c42-34ab-40b7-b9c7-6f0824a280df'

const HUMAN_PROMPT = 'Do all users in my cloudflare account have 2fa enabled?'

async function main() {
  // Truto's magic sauce to get all available tools for a customer connection
  const tools = await getTools(INTEGRATED_ACCOUNT_ID, {
    truto: {
      baseUrl: process.env.TRUTO_API_BASE_URL,
      token: process.env.TRUTO_API_TOKEN as string,
    },
  })
  const llmWithTools = llm.bindTools(values(tools))
  const messages = [
    new SystemMessage(
      'You are an assistant who uses the available tools to give the user an answer. Make sure you respect the arguments required for a tool call, use them to filter down the results wherever necessary. All the tools return a JSON string response, so parse the output correctly and use them in the arguments.'
    ),
    new HumanMessage(HUMAN_PROMPT),
  ]
  let toolCalls: ToolCall[] = []
  do {
    for (const toolCall of toolCalls) {
      const toolResponse = await tools[toolCall.name].invoke(toolCall)
      console.log('\n===================\n')
      console.log(
        'Called tool',
        toolCall.name,
        toolCall.args,
        toolResponse.content
      )
      messages.push(toolResponse)
    }
    const aiMessage = await llmWithTools.invoke(messages)
    messages.push(aiMessage)
    if (isEmpty(aiMessage.tool_calls)) {
      console.log('\n\n===================\n\n')
      console.log(aiMessage.content)
      break
    }
    toolCalls = aiMessage.tool_calls || []
  } while (!isEmpty(toolCalls))
}

main()
