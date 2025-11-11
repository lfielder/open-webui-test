<script lang="ts">
	import { onDestroy } from 'svelte';
	import { TOUR_CONFIG } from '$lib/config/tour';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export let targetElement: HTMLElement | null = null;
	export let bounds: DOMRect | null = null;

	let spotlightRect = { x: 0, y: 0, width: 0, height: 0, radius: TOUR_CONFIG.spotlightRadius };
	let previousRect = { ...spotlightRect };
	let rafId: number | null = null;

	$: if (bounds && targetElement) {
		updateSpotlight();
	}

	function updateSpotlight() {
		if (!bounds) return;

		// Cancel any pending animation frame
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
		}

		// Use requestAnimationFrame for smooth updates
		rafId = requestAnimationFrame(() => {
			// Store previous rect for smooth transitions
			previousRect = { ...spotlightRect };

			// Responsive spotlight padding based on screen size
			const viewportWidth = window.innerWidth;
			const isMobile = viewportWidth < 640;
			const isTablet = viewportWidth >= 640 && viewportWidth < 768;
			
			const padding = isMobile ? 8 : isTablet ? 10 : TOUR_CONFIG.spotlightPadding;

			// Only update if values have changed significantly (avoid micro-updates)
			const newX = bounds.left - padding;
			const newY = bounds.top - padding;
			const newWidth = bounds.width + padding * 2;
			const newHeight = bounds.height + padding * 2;

			// Check if update is needed (threshold of 1px to avoid jitter)
			if (
				Math.abs(spotlightRect.x - newX) > 1 ||
				Math.abs(spotlightRect.y - newY) > 1 ||
				Math.abs(spotlightRect.width - newWidth) > 1 ||
				Math.abs(spotlightRect.height - newHeight) > 1
			) {
				spotlightRect = {
					x: newX,
					y: newY,
					width: newWidth,
					height: newHeight,
					radius: TOUR_CONFIG.spotlightRadius
				};
			}

			rafId = null;
		});
	}

	// Generate SVG path for the spotlight cutout with rounded corners
	$: clipPath = bounds
		? `M 0 0 L ${window.innerWidth} 0 L ${window.innerWidth} ${window.innerHeight} L 0 ${window.innerHeight} Z M ${spotlightRect.x + spotlightRect.radius} ${spotlightRect.y} L ${spotlightRect.x + spotlightRect.width - spotlightRect.radius} ${spotlightRect.y} Q ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y} ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + spotlightRect.radius} L ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + spotlightRect.height - spotlightRect.radius} Q ${spotlightRect.x + spotlightRect.width} ${spotlightRect.y + spotlightRect.height} ${spotlightRect.x + spotlightRect.width - spotlightRect.radius} ${spotlightRect.y + spotlightRect.height} L ${spotlightRect.x + spotlightRect.radius} ${spotlightRect.y + spotlightRect.height} Q ${spotlightRect.x} ${spotlightRect.y + spotlightRect.height} ${spotlightRect.x} ${spotlightRect.y + spotlightRect.height - spotlightRect.radius} L ${spotlightRect.x} ${spotlightRect.y + spotlightRect.radius} Q ${spotlightRect.x} ${spotlightRect.y} ${spotlightRect.x + spotlightRect.radius} ${spotlightRect.y} Z`
		: '';

	onDestroy(() => {
		// Cancel any pending animation frames
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
		}
	});
</script>

<svg
	class="spotlight-overlay absolute inset-0 w-full h-full pointer-events-none"
	data-testid="tour-spotlight"
	transition:fade={{ duration: TOUR_CONFIG.animationDuration, easing: cubicOut }}
>
	<defs>
		<clipPath id="spotlight-clip">
			<path d={clipPath} fill-rule="evenodd">
				<animate
					attributeName="d"
					dur="{TOUR_CONFIG.animationDuration}ms"
					fill="freeze"
					calcMode="spline"
					keySplines="0.4 0 0.2 1"
				/>
			</path>
		</clipPath>
	</defs>
	<rect
		x="0"
		y="0"
		width="100%"
		height="100%"
		fill="rgba(0, 0, 0, {TOUR_CONFIG.backdropOpacity})"
		clip-path="url(#spotlight-clip)"
		class="spotlight-dimmer"
	/>
</svg>

{#if bounds}
	<div
		class="spotlight-ring absolute pointer-events-none"
		style="
			top: {spotlightRect.y}px;
			left: {spotlightRect.x}px;
			width: {spotlightRect.width}px;
			height: {spotlightRect.height}px;
			border-radius: {spotlightRect.radius}px;
			transition: all {TOUR_CONFIG.animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1);
		"
		transition:fade={{ duration: TOUR_CONFIG.animationDuration, easing: cubicOut }}
	/>
{/if}

<style>
	.spotlight-overlay {
		will-change: opacity;
	}

	.spotlight-dimmer {
		will-change: clip-path;
	}

	.spotlight-ring {
		box-shadow:
			0 0 0 2px rgba(59, 130, 246, 0.5),
			0 0 20px rgba(59, 130, 246, 0.3),
			0 0 40px rgba(59, 130, 246, 0.2);
		z-index: 10000;
		will-change: top, left, width, height, border-radius;
		animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse-ring {
		0%, 100% {
			box-shadow:
				0 0 0 2px rgba(59, 130, 246, 0.5),
				0 0 20px rgba(59, 130, 246, 0.3),
				0 0 40px rgba(59, 130, 246, 0.2);
		}
		50% {
			box-shadow:
				0 0 0 2px rgba(59, 130, 246, 0.7),
				0 0 25px rgba(59, 130, 246, 0.4),
				0 0 50px rgba(59, 130, 246, 0.3);
		}
	}

	:global(.dark) .spotlight-ring {
		box-shadow:
			0 0 0 2px rgba(96, 165, 250, 0.5),
			0 0 20px rgba(96, 165, 250, 0.3),
			0 0 40px rgba(96, 165, 250, 0.2);
		animation: pulse-ring-dark 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse-ring-dark {
		0%, 100% {
			box-shadow:
				0 0 0 2px rgba(96, 165, 250, 0.5),
				0 0 20px rgba(96, 165, 250, 0.3),
				0 0 40px rgba(96, 165, 250, 0.2);
		}
		50% {
			box-shadow:
				0 0 0 2px rgba(96, 165, 250, 0.7),
				0 0 25px rgba(96, 165, 250, 0.4),
				0 0 50px rgba(96, 165, 250, 0.3);
		}
	}

	/* Respect reduced motion preferences */
	@media (prefers-reduced-motion: reduce) {
		.spotlight-overlay,
		.spotlight-dimmer,
		.spotlight-ring {
			transition: none !important;
			animation: none !important;
			will-change: auto;
		}
	}
</style>
