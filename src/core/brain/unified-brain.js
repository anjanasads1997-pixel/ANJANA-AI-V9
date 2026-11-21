'use strict';

class UnifiedBrain {
  constructor(options = {}) {
    if (!options.contextStore || !options.providerRouter || !options.toolRegistry) {
      throw new Error('UnifiedBrain requires contextStore, providerRouter and toolRegistry');
    }
    this.contextStore = options.contextStore;
    this.providerRouter = options.providerRouter;
    this.toolRegistry = options.toolRegistry;
    this.permissionManager = options.permissionManager;
    this.version = '11.0.3';
  }

  async respond(input) {
    const { userId, conversationId, message, language } = input || {};
    if (!userId || !conversationId || typeof message !== 'string' || !message.trim()) {
      throw new Error('A user, conversation ID and message are required');
    }
    const context = this.contextStore.get(userId, conversationId);
    const result = await this.providerRouter(message.trim(), language || 'en', context);
    if (!result || typeof result.reply !== 'string' || !result.reply.trim()) {
      throw new Error('AI provider returned an empty response');
    }
    const updated = this.contextStore.append(userId, conversationId, message.trim(), result.reply.trim());
    return {
      ...result,
      reply: result.reply.trim(),
      conversationId,
      contextMessages: updated.length,
      brainVersion: this.version
    };
  }

  getStatus() {
    return {
      name: 'ANJANA Unified AI Brain',
      version: this.version,
      orchestration: true,
      context: this.contextStore.getStatus(),
      tools: this.toolRegistry.describe(),
      permissions: this.permissionManager.getStatus()
    };
  }
}

module.exports = UnifiedBrain;
