/**
 * Test function to verify environment variables are loaded
 * Access at: /.netlify/functions/test-env
 */

exports.handler = async (event, context) => {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasSupabaseUrl = !!process.env.SUPABASE_URL;
  const hasSupabaseKey = !!process.env.SUPABASE_ANON_KEY;

  // Only show first/last 4 characters of keys for security
  const maskKey = (key) => {
    if (!key) return 'NOT SET';
    if (key.length < 12) return '***HIDDEN***';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      environment: process.env.CONTEXT || 'unknown',
      variables: {
        ANTHROPIC_API_KEY: {
          exists: hasAnthropicKey,
          preview: hasAnthropicKey ? maskKey(process.env.ANTHROPIC_API_KEY) : 'NOT SET'
        },
        SUPABASE_URL: {
          exists: hasSupabaseUrl,
          value: process.env.SUPABASE_URL || 'NOT SET'
        },
        SUPABASE_ANON_KEY: {
          exists: hasSupabaseKey,
          preview: hasSupabaseKey ? maskKey(process.env.SUPABASE_ANON_KEY) : 'NOT SET'
        }
      },
      message: hasAnthropicKey
        ? '✓ All environment variables configured correctly'
        : '✗ Missing required environment variables'
    })
  };
};
