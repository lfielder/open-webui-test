<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { tourState, currentStep, tourSteps, nextStep, previousStep, skipTour, completeTour, pauseTour, unpauseTour } from '$lib/stores/tour';
	import { TOUR_CONFIG } from '$lib/config/tour';
	import { page } from '$app/stores';
	import TourSpotlight from './TourSpotlight.svelte';
	import TourTooltip from './TourTooltip.svelte';
	import TourControls from './TourControls.svelte';
	
	// Handle next/finish button
	function handleNext() {
		if ($tourState.currentStepIndex === $tourState.totalSteps - 1) {
			completeTour();
		} else {
			nextStep();
		}
	}

	let targetElement: HTMLElement | null = null;
	let spotlightBounds: DOMRect | null = null;
	let tooltipPosition = { top: 0, left: 0 };
	let tooltipPlacement: 'top' | 'bottom' | 'left' | 'right' | 'center' = 'bottom';
	let overlayElement: HTMLElement;
	let previousFocusedElement: HTMLElement | null = null;
	let announcementElement: HTMLElement;
	let currentRoute: string = '';
	let routeChangeUnsubscribe: (() => void) | null = null;
	let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
	let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
	let rafId: number | null = null;
	let isUpdating = false;

	// Reactive statement to update positions when step changes
	$: if ($currentStep && $tourState.isActive) {
		updatePositions();
		announceStepChange();
	}

	// Handle route changes
	$: if ($page?.url?.pathname) {
		handleRouteChange($page.url.pathname);
	}

	/**
	 * Find target element with error handling
	 * Returns null if element not found or selector is invalid
	 */
	function findTargetElement(selector: string): HTMLElement | null {
		try {
			// Handle special case for body element
			if (selector === 'body') {
				return document.body;
			}

			const element = document.querySelector(selector);
			if (!element) {
				console.warn(`[Tour] Target element not found: ${selector}`);
				return null;
			}
			return element as HTMLElement;
		} catch (error) {
			console.error(`[Tour] Invalid selector: ${selector}`, error);
			return null;
		}
	}

	/**
	 * Handle missing target element by skipping to next available step
	 */
	function handleMissingElement() {
		console.warn(`[Tour] Skipping step ${$tourState.currentStepIndex + 1} due to missing target element`);
		
		// Try to find next step with valid target
		let nextValidStepIndex = $tourState.currentStepIndex + 1;
		let foundValidStep = false;

		while (nextValidStepIndex < $tourState.totalSteps) {
			const nextStepData = $tourSteps[nextValidStepIndex];
			if (nextStepData && findTargetElement(nextStepData.target)) {
				foundValidStep = true;
				break;
			}
			nextValidStepIndex++;
		}

		if (foundValidStep) {
			// Move to next valid step
			tourState.update((s) => ({
				...s,
				currentStepIndex: nextValidStepIndex
			}));
		} else {
			// No more valid steps, complete tour
			console.warn('[Tour] No more valid steps found, completing tour');
			skipTour();
		}
	}

	function updatePositions() {
		if (!$currentStep || isUpdating) return;

		isUpdating = true;

		// Cancel any pending animation frame
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
		}

		// Use requestAnimationFrame for smooth updates
		rafId = requestAnimationFrame(() => {
			// Find target element
			targetElement = findTargetElement($currentStep.target);

			if (!targetElement) {
				// If target not found, handle missing element
				setTimeout(() => {
					handleMissingElement();
					isUpdating = false;
				}, 100);
				return;
			}

			// Scroll element into view if needed (skip for body element)
			if ($currentStep.target !== 'body') {
				targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
			}

			// Wait for scroll to complete
			setTimeout(() => {
				if (!targetElement) {
					isUpdating = false;
					return;
				}

				// Get element bounds
				spotlightBounds = targetElement.getBoundingClientRect();

				// Calculate tooltip position
				calculateTooltipPosition();
				isUpdating = false;
			}, 300);
		});
	}

	function calculateTooltipPosition() {
		if (!spotlightBounds || !$currentStep) return;

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const isMobile = viewportWidth < 640;
		const isTablet = viewportWidth >= 640 && viewportWidth < 768;
		
		// Responsive tooltip dimensions
		const tooltipWidth = isMobile ? viewportWidth * 0.9 : isTablet ? 360 : 400;
		const tooltipHeight = 200; // Estimated height
		const spacing = isMobile ? 12 : isTablet ? 14 : 16; // Responsive spacing

		let placement = $currentStep.placement;
		let top = 0;
		let left = 0;

		// For center placement, center the tooltip
		if (placement === 'center') {
			top = (viewportHeight - tooltipHeight) / 2;
			left = (viewportWidth - tooltipWidth) / 2;
			tooltipPlacement = 'center';
		} else {
			// Calculate position based on placement
			switch (placement) {
				case 'top':
					top = spotlightBounds.top - tooltipHeight - spacing;
					left = spotlightBounds.left + spotlightBounds.width / 2 - tooltipWidth / 2;
					break;
				case 'bottom':
					top = spotlightBounds.bottom + spacing;
					left = spotlightBounds.left + spotlightBounds.width / 2 - tooltipWidth / 2;
					break;
				case 'left':
					top = spotlightBounds.top + spotlightBounds.height / 2 - tooltipHeight / 2;
					left = spotlightBounds.left - tooltipWidth - spacing;
					break;
				case 'right':
					top = spotlightBounds.top + spotlightBounds.height / 2 - tooltipHeight / 2;
					left = spotlightBounds.right + spacing;
					break;
			}

			// Handle viewport boundaries
			const adjustedPosition = adjustForViewportBounds(
				{ top, left },
				tooltipWidth,
				tooltipHeight,
				placement
			);
			top = adjustedPosition.top;
			left = adjustedPosition.left;
			tooltipPlacement = adjustedPosition.placement;
		}

		// Apply custom offset if provided
		if ($currentStep.offset) {
			top += $currentStep.offset.y;
			left += $currentStep.offset.x;
		}

		// On mobile, always position at bottom with proper padding
		if (isMobile) {
			top = viewportHeight - tooltipHeight - 20;
			left = (viewportWidth - tooltipWidth) / 2;
			tooltipPlacement = 'bottom';
		}

		tooltipPosition = { top, left };
	}

	/**
	 * Adjust tooltip position to stay within viewport bounds
	 * Calculates available space in all directions and adjusts placement dynamically
	 */
	function adjustForViewportBounds(
		position: { top: number; left: number },
		width: number,
		height: number,
		placement: string
	): { top: number; left: number; placement: 'top' | 'bottom' | 'left' | 'right' | 'center' } {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const isMobile = viewportWidth < 640;
		const padding = isMobile ? 12 : 16;

		let { top, left } = position;
		let newPlacement = placement as 'top' | 'bottom' | 'left' | 'right' | 'center';

		// On mobile, prefer bottom placement for better UX
		if (isMobile && placement !== 'center') {
			newPlacement = 'bottom';
		}

		// Calculate available space in all directions
		const spaceAbove = top;
		const spaceBelow = viewportHeight - (top + height);
		const spaceLeft = left;
		const spaceRight = viewportWidth - (left + width);

		// Check vertical bounds and adjust
		if (top < padding) {
			// Not enough space above
			if (spaceBelow > height + padding) {
				// Flip to bottom if there's space
				if (placement === 'top' && spotlightBounds) {
					top = spotlightBounds.bottom + (isMobile ? 12 : 16);
					newPlacement = 'bottom';
				} else {
					top = padding;
				}
			} else {
				// Keep at top with padding
				top = padding;
			}
		}

		if (top + height > viewportHeight - padding) {
			// Not enough space below
			if (spaceAbove > height + padding) {
				// Flip to top if there's space
				if (placement === 'bottom' && spotlightBounds) {
					top = spotlightBounds.top - height - (isMobile ? 12 : 16);
					newPlacement = 'top';
				} else {
					top = viewportHeight - height - padding;
				}
			} else {
				// Keep at bottom with padding
				top = viewportHeight - height - padding;
			}
		}

		// Check horizontal bounds and adjust
		if (left < padding) {
			// Not enough space on left
			if (spaceRight > width + padding) {
				// Flip to right if there's space
				if (placement === 'left' && spotlightBounds) {
					left = spotlightBounds.right + (isMobile ? 12 : 16);
					newPlacement = 'right';
				} else {
					left = padding;
				}
			} else {
				// Keep at left with padding
				left = padding;
			}
		}

		if (left + width > viewportWidth - padding) {
			// Not enough space on right
			if (spaceLeft > width + padding) {
				// Flip to left if there's space
				if (placement === 'right' && spotlightBounds) {
					left = spotlightBounds.left - width - (isMobile ? 12 : 16);
					newPlacement = 'left';
				} else {
					left = viewportWidth - width - padding;
				}
			} else {
				// Keep at right with padding
				left = viewportWidth - width - padding;
			}
		}

		// Ensure tooltip doesn't go off screen even after adjustments
		top = Math.max(padding, Math.min(top, viewportHeight - height - padding));
		left = Math.max(padding, Math.min(left, viewportWidth - width - padding));

		return { top, left, placement: newPlacement };
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!$tourState.isActive || !TOUR_CONFIG.allowKeyboardNav) return;

		switch (event.key) {
			case 'Escape':
				event.preventDefault();
				skipTour();
				break;
			case 'Enter':
				event.preventDefault();
				nextStep();
				break;
			case 'ArrowRight':
				event.preventDefault();
				if ($tourState.currentStepIndex < $tourState.totalSteps - 1) {
					nextStep();
				}
				break;
			case 'ArrowLeft':
				event.preventDefault();
				if ($tourState.currentStepIndex > 0) {
					previousStep();
				}
				break;
		}
	}

	function trapFocus(event: FocusEvent) {
		if (!overlayElement || !$tourState.isActive) return;

		const focusableElements = overlayElement.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);

		if (focusableElements.length === 0) return;

		const firstElement = focusableElements[0] as HTMLElement;
		const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

		// If focus moves outside overlay, bring it back
		if (!overlayElement.contains(event.target as Node)) {
			firstElement.focus();
		}
	}

	function announceStepChange() {
		if (!announcementElement || !$currentStep) return;

		// Announce step change to screen readers
		const announcement = `Step ${$tourState.currentStepIndex + 1} of ${$tourState.totalSteps}: ${$currentStep.title}. ${$currentStep.content}`;
		announcementElement.textContent = announcement;

		// Clear announcement after a delay to allow re-announcement if needed
		setTimeout(() => {
			if (announcementElement) {
				announcementElement.textContent = '';
			}
		}, 1000);
	}

	/**
	 * Handle route changes during tour
	 * Pauses tour if route changes, checks if current step is still valid
	 */
	function handleRouteChange(newRoute: string) {
		if (!$tourState.isActive || !currentRoute) {
			currentRoute = newRoute;
			return;
		}

		// Check if route actually changed
		if (currentRoute === newRoute) {
			return;
		}

		console.log(`[Tour] Route changed from ${currentRoute} to ${newRoute}`);
		currentRoute = newRoute;

		// Check if current step's condition is still met
		if ($currentStep?.condition) {
			try {
				const conditionMet = $currentStep.condition();
				if (!conditionMet) {
					console.log(`[Tour] Current step condition no longer met after route change`);
					// Try to find next valid step
					handleMissingElement();
					return;
				}
			} catch (error) {
				console.error('[Tour] Error checking step condition after route change:', error);
				handleMissingElement();
				return;
			}
		}

		// Check if target element still exists
		if ($currentStep && $currentStep.target !== 'body') {
			const targetExists = findTargetElement($currentStep.target);
			if (!targetExists) {
				console.log(`[Tour] Target element no longer exists after route change`);
				// Pause tour briefly to allow page to load
				pauseTour();
				
				// Try to resume after a delay
				setTimeout(() => {
					const targetNowExists = findTargetElement($currentStep!.target);
					if (targetNowExists) {
						console.log(`[Tour] Target element found after delay, resuming tour`);
						unpauseTour();
						updatePositions();
					} else {
						console.log(`[Tour] Target element still not found, skipping step`);
						unpauseTour();
						handleMissingElement();
					}
				}, 500);
			} else {
				// Element exists, just update positions
				updatePositions();
			}
		}
	}

	/**
	 * Debounced resize handler to optimize performance
	 * Uses requestAnimationFrame for smooth updates
	 */
	function handleResize() {
		// Clear existing timeout
		if (resizeTimeout !== null) {
			clearTimeout(resizeTimeout);
		}

		// Debounce resize events
		resizeTimeout = setTimeout(() => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			rafId = requestAnimationFrame(() => {
				updatePositions();
				resizeTimeout = null;
			});
		}, TOUR_CONFIG.debounceDelay);
	}

	/**
	 * Debounced scroll handler to optimize performance
	 * Uses requestAnimationFrame for smooth updates
	 */
	function handleScroll() {
		// Clear existing timeout
		if (scrollTimeout !== null) {
			clearTimeout(scrollTimeout);
		}

		// Debounce scroll events
		scrollTimeout = setTimeout(() => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			rafId = requestAnimationFrame(() => {
				// Only update spotlight bounds, not full position recalculation
				if (targetElement) {
					spotlightBounds = targetElement.getBoundingClientRect();
					calculateTooltipPosition();
				}
				scrollTimeout = null;
			});
		}, TOUR_CONFIG.scrollDebounceDelay);
	}

	onMount(() => {
		// Store previously focused element
		previousFocusedElement = document.activeElement as HTMLElement;

		// Initialize current route
		if (typeof window !== 'undefined') {
			currentRoute = window.location.pathname;
		}

		// Add event listeners
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('resize', handleResize);
		window.addEventListener('scroll', handleScroll, true);
		document.addEventListener('focusin', trapFocus);

		// Initial position calculation
		updatePositions();

		// Announce tour start to screen readers
		if (announcementElement) {
			announcementElement.textContent = 'Getting started tour activated. Press Escape to skip tour.';
			setTimeout(() => {
				if (announcementElement) {
					announcementElement.textContent = '';
				}
			}, 2000);
		}

		// Focus first focusable element in overlay
		setTimeout(() => {
			const firstButton = overlayElement?.querySelector('button');
			firstButton?.focus();
		}, 100);
	});

	onDestroy(() => {
		// Clean up timeouts
		if (resizeTimeout !== null) {
			clearTimeout(resizeTimeout);
		}
		if (scrollTimeout !== null) {
			clearTimeout(scrollTimeout);
		}

		// Cancel any pending animation frames
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
		}

		// Remove event listeners
		window.removeEventListener('keydown', handleKeydown);
		window.removeEventListener('resize', handleResize);
		window.removeEventListener('scroll', handleScroll, true);
		document.removeEventListener('focusin', trapFocus);

		// Restore focus to previously focused element
		if (previousFocusedElement) {
			previousFocusedElement.focus();
		}
	});
</script>

{#if $tourState.isActive && $currentStep}
	<div
		bind:this={overlayElement}
		class="tour-overlay fixed inset-0 z-[9999]"
		role="dialog"
		aria-modal="true"
		aria-labelledby="tour-title"
		aria-describedby="tour-content"
		aria-live="polite"
	>
		<!-- Screen reader announcements -->
		<div
			bind:this={announcementElement}
			class="sr-only"
			role="status"
			aria-live="assertive"
			aria-atomic="true"
		></div>

		<TourSpotlight {targetElement} bounds={spotlightBounds} />
		<TourTooltip
			step={$currentStep}
			position={tooltipPosition}
			placement={tooltipPlacement}
			stepNumber={$tourState.currentStepIndex + 1}
			totalSteps={$tourState.totalSteps}
		>
			<TourControls
				slot="controls"
				canGoPrevious={$tourState.currentStepIndex > 0}
				canGoNext={$tourState.currentStepIndex < $tourState.totalSteps - 1}
				isLastStep={$tourState.currentStepIndex === $tourState.totalSteps - 1}
				on:previous={previousStep}
				on:next={handleNext}
				on:skip={skipTour}
			/>
		</TourTooltip>
	</div>
{/if}

<style>
	.tour-overlay {
		pointer-events: none;
	}

	.tour-overlay :global(*) {
		pointer-events: auto;
	}

	/* Screen reader only content */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
