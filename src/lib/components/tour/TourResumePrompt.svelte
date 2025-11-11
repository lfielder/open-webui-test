<script lang="ts">
	import { showResumePrompt, resumeFromStep, resumeTour, declineResume, dismissResumePrompt } from '$lib/stores/tour';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	// Handle keyboard events
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			dismissResumePrompt();
		} else if (event.key === 'Enter') {
			resumeTour();
		}
	}
</script>

{#if $showResumePrompt}
	<div
		class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="resume-prompt-title"
		aria-describedby="resume-prompt-description"
		on:keydown={handleKeydown}
	>
		<div
			class="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
			transition:fly={{ y: 20, duration: 300, easing: quintOut }}
		>
			<!-- Header -->
			<div class="mb-4">
				<h2 id="resume-prompt-title" class="text-xl font-semibold text-gray-900 dark:text-white">
					Resume Tour?
				</h2>
			</div>

			<!-- Content -->
			<div class="mb-6">
				<p id="resume-prompt-description" class="text-sm text-gray-600 dark:text-gray-300">
					You previously started the getting started tour. Would you like to continue from where you
					left off (step {$resumeFromStep + 1}) or start from the beginning?
				</p>
			</div>

			<!-- Actions -->
			<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
				<button
					type="button"
					class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
					on:click={dismissResumePrompt}
				>
					Not Now
				</button>
				<button
					type="button"
					class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
					on:click={declineResume}
				>
					Start Over
				</button>
				<button
					type="button"
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
					on:click={resumeTour}
					autofocus
				>
					Resume Tour
				</button>
			</div>

			<!-- Keyboard hint -->
			<div class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
				Press <kbd class="rounded bg-gray-200 px-1.5 py-0.5 dark:bg-gray-700">Enter</kbd> to resume or
				<kbd class="rounded bg-gray-200 px-1.5 py-0.5 dark:bg-gray-700">Esc</kbd> to dismiss
			</div>
		</div>
	</div>
{/if}

<style>
	kbd {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
		font-size: 0.875em;
	}
</style>
