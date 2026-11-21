'use strict';

class ToolRegistry {
  constructor(dependencies = {}) {
    this.permissionManager = dependencies.permissionManager;
    this.getRuntimeStatus = dependencies.getRuntimeStatus || (() => ({}));
    this.tools = new Map([
      ['list_available_modules', async () => ({
        modules: ['conversation', 'avatar_voice', 'vision', 'generation', 'coding', 'education', 'documents', 'research', 'memory', 'automation']
      })],
      ['get_runtime_status', async () => this.getRuntimeStatus()]
    ]);
  }

  describe() {
    return [...this.tools.keys()].map(name => ({
      name,
      permission: 'read_only',
      description: name === 'list_available_modules'
        ? 'List the assistant modules currently planned in the V11.0 architecture.'
        : 'Read non-secret runtime availability and configuration status.'
    }));
  }

  async execute(name, args = {}, context = {}) {
    const permission = this.permissionManager.authorize(`read_${name}`, context);
    if (!permission.allowed) {
      const error = new Error('Tool execution is not authorized');
      error.code = 'TOOL_NOT_AUTHORIZED';
      throw error;
    }
    const tool = this.tools.get(String(name));
    if (!tool) {
      const error = new Error('Unknown or unavailable tool');
      error.code = 'TOOL_NOT_FOUND';
      throw error;
    }
    return tool(args, context);
  }
}

module.exports = ToolRegistry;
