import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { OpenAI } from 'openai';
import type { Database } from './database.types';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  throw new Error('Missing Supabase or OpenAI keys from environment variables.');
}

// Supabase client
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

// OpenAI client
const openai = new OpenAI({ apiKey: openaiApiKey });

async function generateCompanyEmbeddings() {
  console.log(`Fetching companies...`);
  const { data: companies, error } = await supabase.from('companies').select('*');

  if (error) {
    console.error('Error fetching companies:', error);
    return;
  }

  if (!companies || companies.length === 0) {
    console.warn('No companies found.');
    return;
  }

  for (const company of companies) {
    const inputText = [
      company.name,
      company.location,
      company.industry,
      company.mission,
      company.vision,
      company.goals,
      company.business_model,
      company.impact_model,
      company.beneficiaries,
    ]
      .filter(Boolean)
      .join(' - ');

    if (!inputText) {
      console.warn(`Skipping company ${company.id} due to empty content.`);
      continue;
    }

    console.log(`Generating embedding for: "${company.name}"`);

    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: inputText,
        encoding_format: 'float',
      });

      const embeddingArray = embeddingResponse.data[0].embedding;

      const { error: updateError } = await supabase
        .from('companies')
        .update({ embeddings: embeddingArray })
        .eq('id', company.id);

      if (updateError) {
        console.error(`Failed to update company ${company.id}:`, updateError);
      } else {
        console.log(`Successfully stored embedding for company ${company.id}.`);
      }
    } catch (err) {
      console.error(`Error generating embedding for company ${company.id}:`, err);
    }
  }

  console.log('All company embeddings generated.');
}

generateCompanyEmbeddings().catch(console.error);
