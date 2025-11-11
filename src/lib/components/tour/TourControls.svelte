<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { TOUR_CONFIG } from '$lib/config/tour';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export let canGoPrevious: boolean = false;
	export let canGoNext: boolean = true;
	export let isLastStep: boolean = false;

	const dispatch = createEventDispatcher();

	function handlePrevious() {
		if (canGoPrevious) {
			dispatch('previous');
		}
	}

	function handleNext() {
		if (canGoNext || isLastStep) {
			dispatch('next');
		}
	}

	function handleSkip() {
		dispatch('skip');
	}

	// Keyboard navigation support
	function handleKeydown(event: KeyboardEvent, action: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			switch (action) {
				case 'previous':
					handlePrevious();
					break;
				case 'next':
					handleNext();
					break;
				case 'skip':
					handleSkip();
					break;
			}
		}
	}

	// Handle Tab key for proper focus management
	function handleTabKey(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const focusableElements = Array.from(
			document.querySelectorAll(
				'.tour-controls button:not(:disabled)'
			)
		) as HTMLElement[];

		if (focusableElements.length === 0) return;

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];
		const activeElement = document.activeElement as HTMLElement;

		// If shift+tab on first element, focus last element
		if (event.shiftKey && activeElement === firstElement) {
			event.preventDefault();
			lastElement.focus();
		}
		// If tab on last element, focus first element
		else if (!event.shiftKey && activeElement === lastElement) {
			event.preventDefault();
			firstElement.focus();
		}
	}
</script>

<div class="tour-controls flex items-center justify-between gap-3" on:keydown={handleTabKey}>
	<div class="flex-shrink-0">
		{#if TOUR_CONFIG.allowSkip}
			<button
				type="button"
				class="skip-button px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] min-w-[44px]"
				data-testid="tour-skip"
				on:click={handleSkip}
				on:keydown={(e) => handleKeydown(e, 'skip')}
				aria-label="Skip tour and close dialog"
				tabindex="0"
			>
				Skip Tour
			</button>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		<button
			type="button"
			class="previous-button px-4 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] min-w-[44px]"
			class:opacity-50={!canGoPrevious}
			class:cursor-not-allowed={!canGoPrevious}
			class:text-gray-700={canGoPrevious}
			class:dark:text-gray-300={canGoPrevious}
			class:hover:bg-gray-100={canGoPrevious}
			class:dark:hover:bg-gray-800={canGoPrevious}
			class:text-gray-400={!canGoPrevious}
			class:dark:text-gray-600={!canGoPrevious}
			data-testid="tour-previous"
			disabled={!canGoPrevious}
			on:click={handlePrevious}
			on:keydown={(e) => handleKeydown(e, 'previous')}
			aria-label="Go to previous step"
			aria-disabled={!canGoPrevious}
			tabindex={canGoPrevious ? 0 : -1}
		>
			Previous
		</button>

		<button
			type="button"
			class="next-button px-4 py-2 text-sm font-medium text-white rounded-lg transition-all min-h-[44px] min-w-[44px]"
			class:bg-blue-600={canGoNext || isLastStep}
			class:hover:bg-blue-700={canGoNext || isLastStep}
			class:dark:bg-blue-500={canGoNext || isLastStep}
			class:dark:hover:bg-blue-600={canGoNext || isLastStep}
			class:opacity-50={!canGoNext && !isLastStep}
			class:cursor-not-allowed={!canGoNext && !isLastStep}
			data-testid="tour-next"
			disabled={!canGoNext && !isLastStep}
			on:click={handleNext}
			on:keydown={(e) => handleKeydown(e, 'next')}
			aria-label={isLastStep ? 'Finish tour and close dialog' : 'Go to next step'}
			aria-disabled={!canGoNext && !isLastStep}
			tabindex="0"
		>
			{#key isLastStep}
				<span in:scale={{ start: 0.9, duration: 200, easing: cubicOut }}>
					{isLastStep ? 'Finish' : 'Next'}
				</span>
			{/key}
		</button>
	</div>
</div>

<style>
	.tour-controls {
		width: 100%;
	}

	button {
		font-weight: 500;
		cursor: pointer;
		user-select: none;
		outline: none;
		border: none;
		background: transparent;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	button:focus-visible {
		outline: 2px solid rgb(59, 130, 246);
		outline-offset: 2px;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
	}

	:global(.dark) button:focus-visible {
		outline-color: rgb(96, 165, 250);
		box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.2);
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		button:focus-visible {
			outline-width: 3px;
			outline-offset: 3px;
		}
	}

	button:disabled {
		pointer-events: none;
	}

	button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.next-button {
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.next-button:hover:not(:disabled) {
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		transform: translateY(-1px);
	}

	.next-button:active:not(:disabled) {
		transform: translateY(0) scale(0.98);
	}

	.skip-button:hover {
		transform: translateX(-2px);
	}

	.previous-button:hover:not(:disabled) {
		transform: translateX(-2px);
	}

	/* Respect reduced motion preferences */
	@media (prefers-reduced-motion: reduce) {
		button {
			transition: none !important;
		}
		
		button:hover:not(:disabled),
		button:active:not(:disabled) {
			transform: none !important;
		}
	}

	/* Mobile responsive styles (max-width: 640px) */
	@media (max-width: 640px) {
		.tour-controls {
			flex-direction: column;
			gap: 0.5rem;
		}

		.tour-controls > div {
			width: 100%;
		}

		.tour-controls button {
			width: 100%;
			justify-content: center;
			/* Ensure minimum 44x44px touch targets */
			min-height: 44px;
			min-width: 44px;
			padding: 0.75rem 1rem;
			font-size: 0.9375rem;
		}

		.skip-button {
			order: 2;
		}

		.tour-controls > div:last-child {
			order: 1;
			display: flex;
			gap: 0.5rem;
		}

		.previous-button,
		.next-button {
			flex: 1;
		}
	}

	/* Tablet responsive styles (640px - 768px) */
	@media (min-width: 640px) and (max-width: 768px) {
		button {
			min-height: 40px;
			padding: 0.625rem 1rem;
		}
	}

	/* Desktop styles (min-width: 768px) */
	@media (min-width: 768px) {
		button {
			min-height: 36px;
		}
	}
</style>
