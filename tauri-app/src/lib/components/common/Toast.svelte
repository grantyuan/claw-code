<script lang="ts">
  interface Props {
    message?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
  }

  let { message = '', type = 'info', duration = 3000 }: Props = $props();

  let visible = $state(false);
  let timeoutId: ReturnType<typeof setTimeout>;

  const typeClasses: Record<string, string> = {
    info: 'bg-primary-600 text-white',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-600 text-white',
    error: 'bg-red-600 text-white',
  };

  export function show(msg: string, msgType?: 'info' | 'success' | 'warning' | 'error') {
    message = msg;
    if (msgType) type = msgType;
    visible = true;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => { visible = false; }, duration);
  }

  export function hide() {
    visible = false;
    clearTimeout(timeoutId);
  }
</script>

{#if visible && message}
  <div class="fixed bottom-4 right-4 z-50 animate-slide-up">
    <div class="rounded-lg px-4 py-3 shadow-lg {typeClasses[type]} flex items-center gap-2">
      <span class="text-sm font-medium">{message}</span>
      <button class="ml-2 hover:opacity-80" onclick={hide}>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
