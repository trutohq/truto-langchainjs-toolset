# Truto's SuperAI Toolset for Langchain.js

A powerful toolset for integrating Truto's Proxy APIs with Langchain.js applications. This package provides all the Proxy APIs configured to be used as a tool on Truto as tools to Langchain. Read more about configuring tools on Truto [here](https://truto.one/docs/guides/tools/overview).

## Installation

```bash
npm install @truto/langchain-toolset
# or
yarn add @truto/langchain-toolset
```

## Prerequisites

- Node.js 22.14.0 or higher
- Yarn 1.22.19 or higher
- Truto API credentials
- [Bun](https://bun.sh) (for running examples)
- OpenAI API key (only needed for running examples)

## Environment Setup

Create a `.env` file in your project root with the following variables:

```env
TRUTO_API_TOKEN=your_truto_api_token

#OPTIONAL
OPENAI_API_KEY=your_openai_api_key # if you are using OpenAI models
TRUTO_API_BASE_URL=your_truto_api_base_url
```

## Usage

Here's a complete example showing how to use the toolset with Langchain.js, including handling multiple tool executions:

To create or modify tools, please refer this [Truto guide](https://truto.one/docs/guides/tools/overview).

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { isEmpty, values } from 'lodash-es';
import { ToolCall } from '@langchain/core/dist/messages/tool';
import { getTools } from '@truto/langchain-toolset';

// Initialize the LLM
const llm = new ChatOpenAI({
  model: 'o3-mini',
});

const INTEGRATED_ACCOUNT_ID = 'your_account_id';

async function main() {
  // Get all available tools for a customer connection
  const tools = await getTools(INTEGRATED_ACCOUNT_ID, {
    truto: {
      baseUrl: process.env.TRUTO_API_BASE_URL,
      token: process.env.TRUTO_API_TOKEN as string,
    },
    // Optional: Filter tools by specific methods
    methods: ['list', 'get', 'create', 'update', 'delete', 'read', 'write', 'custom', 'your_custom_method_name']
  });

  // Bind tools to the LLM
  const llmWithTools = llm.bindTools(values(tools));

  // Create your messages
  const messages = [
    new SystemMessage(
      'You are an assistant who uses the available tools to give the user an answer. Make sure you respect the arguments required for a tool call, use them to filter down the results wherever necessary. All the tools return a JSON string response, so parse the output correctly and use them in the arguments.'
    ),
    new HumanMessage('Your question here'),
  ];

  let toolCalls: ToolCall[] = [];
  do {
    // Execute any pending tool calls
    for (const toolCall of toolCalls) {
      const toolResponse = await tools[toolCall.name].invoke(toolCall);
      console.log('\n===================\n');
      console.log(
        'Called tool',
        toolCall.name,
        toolCall.args,
        toolResponse.content
      );
      messages.push(toolResponse);
    }

    // Get the next AI response
    const aiMessage = await llmWithTools.invoke(messages);
    messages.push(aiMessage);

    // Check if there are more tool calls to execute
    if (isEmpty(aiMessage.tool_calls)) {
      console.log('\n\n===================\n\n');
      console.log(aiMessage.content);
      break;
    }
    toolCalls = aiMessage.tool_calls || [];
  } while (!isEmpty(toolCalls));
}

main();
```

This example demonstrates:
- How to initialize the tools with Truto credentials
- How to bind tools to a Langchain.js LLM
- How to handle multiple tool calls in sequence
- How to process tool responses and continue the conversation
- How to properly handle the conversation flow until all tool calls are complete

## Running Examples

The repository includes example code in the `examples` directory. To run the examples:

1. First, install Bun if you haven't already:
   - Visit [bun.sh](https://bun.sh) to install Bun for your platform
   - Or use the following command:
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Install dependencies:
```bash
bun install
```

3. Set up your environment variables in `.env` as described above.

4. Run the example:
```bash
bun run examples/index.ts
```

The example demonstrates how to:
- Initialize the tools with Truto credentials
- Bind tools to a Langchain.js LLM
- Make tool calls and handle responses
- Process multi-turn conversations with tool usage

## Development

To build the package locally:

```bash
yarn build
```

To run type checking:

```bash
yarn check
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

