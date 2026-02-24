/**
 * Mock data for the RAG Pipeline page.
 */

export const mockRAGIngestResult = {
  status: 'ok',
  documents_ingested: 3,
  chunks_created: 18,
};

export const mockRAGQueryResult = {
  question: 'What is the difference between Standard and PTU deployments?',
  answer:
    'Standard deployments use a pay-as-you-go model where you are charged per token processed. PTU (Provisioned Throughput Unit) deployments provide reserved capacity with a guaranteed throughput level, billed as a fixed monthly commitment. Standard is better for variable workloads while PTU is more cost-effective for high-volume, consistent traffic.',
  context_chunks: [
    {
      chunk_id: 'doc1_chunk_3',
      text: 'Standard deployments are billed per 1K tokens. Pricing varies by model. Ideal for development, testing, and variable production traffic.',
      score: 0.92,
      metadata: { source: 'deployment-guide.pdf', page: 12 },
    },
    {
      chunk_id: 'doc1_chunk_7',
      text: 'PTU deployments provide dedicated throughput capacity measured in Provisioned Throughput Units. Each PTU delivers a specific number of tokens per minute. Monthly commitment required. Best for latency-sensitive, high-volume production workloads.',
      score: 0.89,
      metadata: { source: 'deployment-guide.pdf', page: 24 },
    },
    {
      chunk_id: 'doc2_chunk_1',
      text: 'When migrating from Standard to PTU, run a shadow test first to measure your actual token throughput requirements. Use the Azure Monitor metrics to determine peak TPM before sizing your PTU reservation.',
      score: 0.81,
      metadata: { source: 'migration-best-practices.md', section: 'PTU Sizing' },
    },
  ],
  provider: 'azure_openai',
  deployment: 'my-deployment',
  latency_ms: 1240,
  tokens_prompt: 520,
  tokens_completion: 180,
};

export const mockRAGDocuments = [
  {
    id: 'doc-1',
    text: 'Azure OpenAI deployment types include Standard (pay-as-you-go), PTU (Provisioned Throughput Units), Global Standard, and Data Zone deployments. Each type has different pricing, latency, and capacity characteristics.',
    metadata: { source: 'deployment-guide.pdf', pages: 45 },
  },
  {
    id: 'doc-2',
    text: 'Migration best practices: Always run evaluation benchmarks before switching models. Use golden datasets with at least 100 test cases covering edge cases. Monitor quality metrics including coherence, fluency, relevance, and groundedness.',
    metadata: { source: 'migration-best-practices.md', version: '2.1' },
  },
  {
    id: 'doc-3',
    text: 'Cost optimization strategies include model cascading (try cheaper models first), prompt caching, response caching, and dynamic batch sizing based on latency requirements.',
    metadata: { source: 'cost-optimization.docx', chapter: 'Strategies' },
  },
];
