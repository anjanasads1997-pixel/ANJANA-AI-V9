'use strict';

const CONFIRMATION_REQUIRED = new Set([
  'memory_write', 'file_write', 'external_share', 'financial_action',
  'device_control', 'security_control', 'account_change', 'data_delete'
]);

class PermissionManager {
  classify(action) {
    const name = String(action || '').trim().toLowerCase();
    if (!name) return 'deny';
    if (CONFIRMATION_REQUIRED.has(name)) return 'confirmation_required';
    if (name.startsWith('read_') || name.startsWith('get_') || name.startsWith('list_')) return 'allow_read_only';
    return 'deny';
  }

  authorize(action, context = {}) {
    const classification = this.classify(action);
    if (classification === 'allow_read_only') return { allowed: true, requiresConfirmation: false, reason: 'read_only' };
    if (classification === 'confirmation_required') {
      return { allowed: false, requiresConfirmation: true, reason: 'explicit_user_confirmation_required' };
    }
    return { allowed: false, requiresConfirmation: false, reason: 'action_not_allowlisted' };
  }

  getStatus() {
    return { policy: 'deny_by_default', readOnlyActions: 'allowlisted', sensitiveActions: 'explicit_confirmation_required' };
  }
}

module.exports = PermissionManager;
