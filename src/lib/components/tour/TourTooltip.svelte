<script lang="ts">
	import type { TourStep } from '$lib/stores/tour';
	import { TOUR_CONFIG } from '$lib/config/tour';
	import { fly, fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export let step: TourStep;
	export let position: { top: number; left: number };
	export let placement: 'top' | 'bottom' | 'left' | 'right' | 'center' = 'bottom';
	export let stepNumber: number;
	export let totalSteps: number;

	// Calculate arrow position based on placement
	function getArrowClass(placement: string): string {
		switch (placement) {
			case 'top':
				return 'arrow-bottom';
			case 'bottom':
				return 'arrow-top';
			case 'left':
				return 'arrow-right';
			case 'right':
				return 'arrow-left';
			default:
				return '';
		}
	}

	// Calculate fly direction based on placement
	function getFlyParams(placement: string) {
		switch (placement) {
			case 'top':
				return { y: 20, x: 0 };
			case 'bottom':
				return { y: -20, x: 0 };
			case 'left':
				return { y: 0, x: 20 };
			case 'right':
				return { y: 0, x: -20 };
			case 'center':
				return { y: 0, x: 0 };
			default:
				return { y: 20, x: 0 };
		}
	}

	$: arrowClass = getArrowClass(placement);
	$: showArrow = placement !== 'center';
	$: flyParams = getFlyParams(placement);
	
	// Track previous step number for progress animation
	let previousStepNumber = stepNumber;
	$: {
		if (stepNumber !== previousStepNumber) {
			previousStepNumber = stepNumber;
		}
	}
</script>

<div
	class="tour-tooltip absolute z-[10001] pointer-events-auto"
	style="top: {position.top}px; left: {position.left}px;"
	data-testid="tour-tooltip"
	in:fly={{ ...flyParams, duration: TOUR_CONFIG.animationDuration, easing: cubicOut }}
	out:fade={{ duration: TOUR_CONFIG.animationDuration / 2, easing: cubicOut }}
>
	<div
		class="tooltip-content bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 backdrop-blur-xl 
		       max-w-[90vw] sm:max-w-[360px] md:max-w-[400px] w-full"
		in:scale={{ start: 0.95, duration: TOUR_CONFIG.animationDuration, easing: cubicOut, delay: 50 }}
	>
		<div class="tooltip-header p-4 pb-3 border-b border-gray-200 dark:border-gray-700">
			<div class="flex items-center justify-between gap-3">
				<h3 id="tour-title" class="text-lg font-semibold text-gray-900 dark:text-white">
					{step.title}
				</h3>
				{#if TOUR_CONFIG.showProgress}
					{#key stepNumber}
						<span
							class="tour-progress text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
							data-testid="tour-progress"
							in:scale={{ start: 0.8, duration: 200, easing: cubicOut }}
						>
							{stepNumber} / {totalSteps}
						</span>
					{/key}
				{/if}
			</div>
		</div>

		<div class="tooltip-body p-4">
			{#key step.id}
				<p 
					id="tour-content" 
					class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
					in:fade={{ duration: TOUR_CONFIG.animationDuration, delay: 100, easing: cubicOut }}
				>
					{step.content}
				</p>
			{/key}
		</div>

		<div class="tooltip-footer p-4 pt-3 border-t border-gray-200 dark:border-gray-700">
			<slot name="controls" />
		</div>
	</div>

	{#if showArrow}
		<div 
			class="tooltip-arrow {arrowClass}"
			in:fade={{ duration: TOUR_CONFIG.animationDuration, delay: 50 }}
		/>
	{/if}
</div>

<style>
	.tour-tooltip {
		transition: top 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
		            left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		will-change: top, left;
	}

	/* Respect reduced motion preferences */
	@media (prefers-reduced-motion: reduce) {
		.tour-tooltip {
			transition: none !important;
			will-change: auto;
		}
	}

	.tooltip-content {
		position: relative;
		max-height: 80vh;
		overflow-y: auto;
		will-change: transform, opacity;
	}

	.tooltip-arrow {
		position: absolute;
		width: 0;
		height: 0;
		border-style: solid;
	}

	.arrow-top {
		top: -8px;
		left: 50%;
		transform: translateX(-50%);
		border-width: 0 8px 8px 8px;
		border-color: transparent transparent white transparent;
	}

	:global(.dark) .arrow-top {
		border-color: transparent transparent rgb(17, 24, 39) transparent;
	}

	.arrow-bottom {
		bottom: -8px;
		left: 50%;
		transform: translateX(-50%);
		border-width: 8px 8px 0 8px;
		border-color: white transparent transparent transparent;
	}

	:global(.dark) .arrow-bottom {
		border-color: rgb(17, 24, 39) transparent transparent transparent;
	}

	.arrow-left {
		left: -8px;
		top: 50%;
		transform: translateY(-50%);
		border-width: 8px 8px 8px 0;
		border-color: transparent white transparent transparent;
	}

	:global(.dark) .arrow-left {
		border-color: transparent rgb(17, 24, 39) transparent transparent;
	}

	.arrow-right {
		right: -8px;
		top: 50%;
		transform: translateY(-50%);
		border-width: 8px 0 8px 8px;
		border-color: transparent transparent transparent white;
	}

	:global(.dark) .arrow-right {
		border-color: transparent transparent transparent rgb(17, 24, 39);
	}

	/* Mobile responsive styles (max-width: 640px) */
	@media (max-width: 640px) {
		.tooltip-content {
			max-width: 90vw;
			border-radius: 1rem;
		}

		.tooltip-header {
			padding: 0.875rem;
			padding-bottom: 0.625rem;
		}

		.tooltip-header h3 {
			font-size: 1rem;
			line-height: 1.5;
		}

		.tour-progress {
			font-size: 0.75rem;
		}

		.tooltip-body {
			padding: 0.875rem;
		}

		.tooltip-body p {
			font-size: 0.875rem;
			line-height: 1.5;
		}

		.tooltip-footer {
			padding: 0.875rem;
			padding-top: 0.625rem;
		}
	}

	/* Tablet responsive styles (640px - 768px) */
	@media (min-width: 640px) and (max-width: 768px) {
		.tooltip-content {
			max-width: 360px;
		}

		.tooltip-header h3 {
			font-size: 1.0625rem;
		}

		.tooltip-body p {
			font-size: 0.9375rem;
		}
	}

	/* Desktop styles (min-width: 768px) */
	@media (min-width: 768px) {
		.tooltip-content {
			max-width: 400px;
		}
	}

	/* Scrollbar styling */
	.tooltip-content::-webkit-scrollbar {
		width: 6px;
	}

	.tooltip-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.tooltip-content::-webkit-scrollbar-thumb {
		background: rgba(156, 163, 175, 0.5);
		border-radius: 3px;
	}

	:global(.dark) .tooltip-content::-webkit-scrollbar-thumb {
		background: rgba(75, 85, 99, 0.5);
	}

	/* Focus indicators for accessibility */
	.tooltip-content:focus-within {
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
	}

	:global(.dark) .tooltip-content:focus-within {
		box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.3);
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.tooltip-content {
			border-width: 2px;
		}

		.tooltip-header,
		.tooltip-footer {
			border-width: 2px;
		}
	}
</style>
