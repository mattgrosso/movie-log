<template>
  <div v-if="isVisible" class="error-log-viewer">
    <div class="log-header">
      <div class="log-title">
        <i class="bi bi-bug"></i>
        Error Logs
        <span class="log-count">({{ filteredLogs.length }})</span>
      </div>
      <div class="log-controls">
        <select v-model="selectedLevel" class="form-select form-select-sm me-2">
          <option value="">All Levels</option>
          <option value="error">Errors</option>
          <option value="warn">Warnings</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <button @click="copyToClipboard" class="btn btn-sm btn-outline-primary me-2" :disabled="filteredLogs.length === 0">
          <i class="bi bi-clipboard"></i>
          Copy
        </button>
        <button @click="clearLogs" class="btn btn-sm btn-outline-danger me-2" :disabled="filteredLogs.length === 0">
          <i class="bi bi-trash"></i>
          Clear
        </button>
        <button @click="toggleExpanded" class="btn btn-sm btn-outline-secondary">
          <i :class="isExpanded ? 'bi bi-chevron-up' : 'bi bi-chevron-down'"></i>
        </button>
      </div>
    </div>
    
    <div v-if="isExpanded" class="log-body">
      <div class="log-stats mb-2">
        <small class="text-muted">
          {{ stats.errors }} errors, {{ stats.warnings }} warnings, {{ stats.total }} total
          <span v-if="stats.newest"> • Latest: {{ formatTime(stats.newest) }}</span>
        </small>
      </div>
      
      <div v-if="filteredLogs.length === 0" class="no-logs">
        <i class="bi bi-check-circle text-success"></i>
        No logs to display
      </div>
      
      <div v-else class="log-entries">
        <div 
          v-for="log in filteredLogs" 
          :key="log.id" 
          :class="['log-entry', `log-${log.level}`]"
        >
          <div class="log-entry-header">
            <span :class="['log-level', `level-${log.level}`]">
              {{ log.level.toUpperCase() }}
            </span>
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          </div>
          <div class="log-message">{{ log.message }}</div>
          <div v-if="log.context && Object.keys(log.context).length > 0" class="log-context">
            <details>
              <summary>Context</summary>
              <pre>{{ JSON.stringify(log.context, null, 2) }}</pre>
            </details>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="copySuccess" class="copy-notification">
      <i class="bi bi-check-circle"></i>
      Copied to clipboard!
    </div>
  </div>
</template>

<script>
import ErrorLogService from '../services/ErrorLogService.js';

export default {
  name: 'ErrorLogViewer',
  props: {
    isVisible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      logs: [],
      selectedLevel: '',
      isExpanded: false,
      copySuccess: false,
      refreshInterval: null
    };
  },
  computed: {
    filteredLogs() {
      if (!this.selectedLevel) {
        return this.logs;
      }
      return this.logs.filter(log => log.level === this.selectedLevel);
    },
    stats() {
      return ErrorLogService.getStats();
    }
  },
  watch: {
    isVisible(newVal) {
      if (newVal) {
        this.refreshLogs();
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
    }
  },
  mounted() {
    this.refreshLogs();
    if (this.isVisible) {
      this.startAutoRefresh();
    }
  },
  beforeUnmount() {
    this.stopAutoRefresh();
  },
  methods: {
    refreshLogs() {
      this.logs = ErrorLogService.getLogs();
    },
    clearLogs() {
      ErrorLogService.clearLogs();
      this.refreshLogs();
    },
    toggleExpanded() {
      this.isExpanded = !this.isExpanded;
    },
    async copyToClipboard() {
      try {
        const logText = ErrorLogService.getLogsAsText();
        await navigator.clipboard.writeText(logText);
        this.showCopySuccess();
      } catch (error) {
        // Fallback for older browsers
        this.fallbackCopyToClipboard(ErrorLogService.getLogsAsText());
      }
    },
    fallbackCopyToClipboard(text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        this.showCopySuccess();
      } catch (error) {
        console.error('Failed to copy logs:', error);
        ErrorLogService.error('Failed to copy logs to clipboard', { error: error.message });
      } finally {
        document.body.removeChild(textArea);
      }
    },
    showCopySuccess() {
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    },
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },
    startAutoRefresh() {
      this.refreshInterval = setInterval(() => {
        this.refreshLogs();
      }, 1000); // Refresh every second when visible
    },
    stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }
  }
};
</script>

<style scoped>
.error-log-viewer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1a1a1a;
  color: #ffffff;
  border-top: 2px solid #333;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1050;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
}

.log-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.log-title i {
  margin-right: 6px;
}

.log-count {
  margin-left: 6px;
  font-size: 0.8rem;
  color: #aaa;
}

.log-controls {
  display: flex;
  align-items: center;
}

.log-controls .form-select {
  width: 120px;
  background: #333;
  border-color: #555;
  color: #fff;
  font-size: 0.8rem;
}

.log-controls .btn {
  font-size: 0.75rem;
  padding: 4px 8px;
}

.log-body {
  padding: 8px 12px;
  overflow-y: auto;
  flex: 1;
}

.log-stats {
  font-size: 0.75rem;
  padding-bottom: 6px;
  border-bottom: 1px solid #333;
}

.no-logs {
  text-align: center;
  padding: 20px;
  color: #888;
}

.no-logs i {
  font-size: 1.5rem;
  margin-right: 8px;
}

.log-entries {
  max-height: 300px;
  overflow-y: auto;
}

.log-entry {
  margin-bottom: 8px;
  padding: 6px 8px;
  border-left: 3px solid #555;
  background: #252525;
  border-radius: 0 4px 4px 0;
  font-size: 0.8rem;
}

.log-entry.log-error {
  border-left-color: #dc3545;
  background: rgba(220, 53, 69, 0.1);
}

.log-entry.log-warn {
  border-left-color: #ffc107;
  background: rgba(255, 193, 7, 0.1);
}

.log-entry.log-info {
  border-left-color: #0dcaf0;
  background: rgba(13, 202, 240, 0.1);
}

.log-entry.log-debug {
  border-left-color: #6c757d;
  background: rgba(108, 117, 125, 0.1);
}

.log-entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.log-level {
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
}

.level-error {
  background: #dc3545;
  color: white;
}

.level-warn {
  background: #ffc107;
  color: black;
}

.level-info {
  background: #0dcaf0;
  color: black;
}

.level-debug {
  background: #6c757d;
  color: white;
}

.log-time {
  color: #aaa;
  font-size: 0.7rem;
}

.log-message {
  word-break: break-word;
  line-height: 1.3;
}

.log-context {
  margin-top: 4px;
}

.log-context details {
  font-size: 0.7rem;
}

.log-context summary {
  color: #aaa;
  cursor: pointer;
  user-select: none;
}

.log-context pre {
  background: #1a1a1a;
  padding: 4px 6px;
  border-radius: 3px;
  margin: 4px 0 0 0;
  font-size: 0.65rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.copy-notification {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #28a745;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 1060;
  animation: fadeInOut 2s ease-in-out;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  20%, 80% { opacity: 1; }
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .log-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .log-controls {
    justify-content: space-between;
  }
  
  .log-controls .form-select {
    width: 100px;
  }
  
  .log-entries {
    max-height: 250px;
  }
}
</style>