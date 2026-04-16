import { Hono } from 'hono'
import { strictRateLimit } from '@/middleware/rateLimiter'
import {
    getClaws,
    getAdminClaws,
    getClaw,
    createClaw,
    initiateClawPurchase,
    syncClaw,
    startClaw,
    stopClaw,
    restartClaw,
    deleteClaw,
    cancelDeletion,
    hardDeleteClaw,
    getClawDiagnostics,
    getClawLogs,
    repairClaw,
    listClawFiles,
    readClawFile,
    updateClawFile,
    reinstallClaw,
    exportClaw
} from '@/controllers/claws'

const app = new Hono<{ Variables: { userId: string } }>()

app.get('/', getClaws)
app.get('/admin', getAdminClaws)
app.get('/:id', getClaw)
app.post('/', strictRateLimit, createClaw) // Direct creation (for free tier or testing)
app.post('/purchase', strictRateLimit, initiateClawPurchase) // Paid creation with Polar checkout
app.post('/:id/sync', syncClaw)
app.post('/:id/start', startClaw)
app.post('/:id/stop', stopClaw)
app.post('/:id/restart', restartClaw)
app.post('/:id/cancel-deletion', cancelDeletion)
app.post('/:id/hard-delete', hardDeleteClaw)
app.post('/:id/diagnostics/status', getClawDiagnostics)
app.post('/:id/diagnostics/logs', getClawLogs)
app.post('/:id/diagnostics/repair', repairClaw)
app.post('/:id/reinstall', reinstallClaw)
app.get('/:id/export', exportClaw)
app.post('/:id/files', listClawFiles)
app.post('/:id/files/read', readClawFile)
app.put('/:id/files', updateClawFile)
app.delete('/:id', deleteClaw)

export default app