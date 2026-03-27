// api/checkout.js — POST /api/checkout
// Creates a Lemon Squeezy checkout URL for Pro or Pro Plus
// No SDK needed — Lemon Squeezy has a clean REST API
// Docs: https://docs.lemonsqueezy.com/api/checkouts

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { collector_id, tier = 'pro', notify_email } = req.body || {};

  if (!collector_id || !/^[a-z0-9]{4,16}$/.test(collector_id)) {
    return res.status(400).json({ error: 'Missing or invalid collector_id.' });
  }

  const validTiers = ['pro', 'pro_plus'];
  if (!validTiers.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier.' });
  }

  // Map tier to Lemon Squeezy variant IDs
  // You get these from your LS dashboard after creating products
  const VARIANT_IDS = {
    pro:      process.env.LS_VARIANT_PRO,       // $7/mo variant ID
    pro_plus: process.env.LS_VARIANT_PRO_PLUS,  // $19/mo variant ID
  };

  const variantId = VARIANT_IDS[tier];
  if (!variantId) {
    return res.status(500).json({ error: `Variant ID for ${tier} not configured.` });
  }

  const origin = `https://${req.headers.host}`;

  try {
    // Create a Lemon Squeezy checkout session via their API
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${process.env.LS_API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            // Pre-fill email if provided
            checkout_data: {
              email: notify_email || undefined,
              custom: {
                // Pass through so webhook can identify the collector
                collector_id,
                tier,
                notify_email: notify_email || '',
              },
            },
            // Redirect URLs after payment
            product_options: {
              redirect_url: `${origin}/dashboard.html?id=${collector_id}&upgraded=1`,
            },
            checkout_options: {
              // Allow discount codes
              discount: true,
              // Skip email step if pre-filled
              ...(notify_email && { skip_trial: false }),
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: process.env.LS_STORE_ID },
            },
            variant: {
              data: { type: 'variants', id: variantId },
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Lemon Squeezy checkout error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Failed to create checkout.' });
    }

    const checkoutUrl = data?.data?.attributes?.url;
    if (!checkoutUrl) {
      return res.status(500).json({ error: 'No checkout URL returned.' });
    }

    return res.status(200).json({ url: checkoutUrl });

  } catch (err) {
    console.error('Checkout fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session.' });
  }
};
