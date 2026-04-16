import test from 'node:test'
import assert from 'node:assert/strict'

import generateCloudInit from './generateCloudInit'

test('generateCloudInit contains gateway, nginx and certbot steps', () => {
    const script = generateCloudInit(
        'root-password',
        'demo-subdomain',
        'clawhost.cloud',
        'gateway-token-123',
        'openai/gpt-4.1',
        'sk-test',
        'pro'
    )

    assert.match(script, /openclaw gateway --port 18789 --bind loopback/)
    assert.match(script, /"token": "gateway-token-123"/)
    assert.match(script, /server_name demo-subdomain\.clawhost\.cloud;/)
    assert.match(script, /certbot --nginx -d demo-subdomain\.clawhost\.cloud/)
    assert.match(script, /final_message: "OpenClaw instance ready! Access dashboard at https:\/\/demo-subdomain\.clawhost\.cloud\//)
})

test('generateCloudInit injects provider API env for selected model', () => {
    const script = generateCloudInit(
        'root-password',
        'demo-subdomain',
        'clawhost.cloud',
        'gateway-token-123',
        'anthropic/claude-sonnet-4',
        'anthropic-key',
        'basic'
    )

    assert.match(script, /ANTHROPIC_API_KEY/)
    assert.match(script, /anthropic-key/)
})