import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { isEmpty, values } from 'lodash-es'
import { ToolCall } from '@langchain/core/dist/messages/tool'
import { getTools } from '../src'
import ora from 'ora'

// Make sure to set the OPENAI_API_KEY environment variable
const llm = new ChatOpenAI({
  model: 'o3-mini',
})

const INTEGRATED_ACCOUNT_ID = '64f860f2-7556-466d-83f0-245322e8f160'

const HUMAN_PROMPT =
  'Is 2fa enabled for all the users in my cloudflare account?'

async function main() {
  const spinner = ora('...').start()

  spinner.info('Question: ' + HUMAN_PROMPT)

  spinner.start('Fetching tools')

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
      spinner.start(`Calling tool ${toolCall.name}`)
      const toolResponse = await tools[toolCall.name].invoke(toolCall)
      spinner.succeed(`Tool ${toolCall.name} called successfully`)
      messages.push(toolResponse)
    }

    spinner.start('Thinking...')

    const aiMessage = await llmWithTools.invoke(messages)
    messages.push(aiMessage)

    if (isEmpty(aiMessage.tool_calls)) {
      spinner.succeed('Answer: ' + aiMessage.content.toString())
      break
    }

    toolCalls = aiMessage.tool_calls || []
  } while (!isEmpty(toolCalls))
}

main()
