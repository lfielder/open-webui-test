import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import { showSidebar, mobile } from './index';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TourStep {
	id: string;
	title: string;
	content: string;
	target: string; // CSS selector for element to highlight
	placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
	offset?: { x: number; y: number };
	condition?: () => boolean; // Optional: only show if condition is true
	beforeStep?: () => void; // Optional: execute before showing step
	afterStep?: () => void; // Optional: execute after completing step
}

export interface TourState {
	isActive: boolean;
	currentStepIndex: number;
	totalSteps: number;
	isCompleted: boolean;
	isPaused: boolean;
}

interface TourStorage {
	completed: boolean;
	currentStep: number;
	dismissedAt: number | null;
	version: string;
}

// ============================================================================
// Constants
// ============================================================================

const TOUR_STORAGE_KEY = 'tour:state';
const TOUR_VERSION = '1.0.0';

// ============================================================================
// Store Initialization
// ============================================================================

const initialTourState: TourState = {
	isActive: false,
	currentStepIndex: 0,
	totalSteps: 0,
	isCompleted: false,
	isPaused: false
};

// Writable stores
export const tourState: Writable<TourState> = writable(initialTourState);
export const showTour: Writable<boolean> = writable(false);
export const tourSteps: Writable<TourStep[]> = writable([]);
export const showResumePrompt: Writable<boolean> = writable(false);
export const resumeFromStep: Writable<number> = writable(0);

// Derived store for current step
export const currentStep: Readable<TourStep | null> = derived(
	[tourState, tourSteps],
	([$tourState, $tourSteps]) => {
		if (!$tourState.isActive || $tourSteps.length === 0) {
			return null;
		}
		return $tourSteps[$tourState.currentStepIndex] || null;
	}
);

// ============================================================================
// Element Visibility Helpers
// ============================================================================

/**
 * Ensure an element is visible before showing its tour step
 * Returns true if element is now visible, false if it cannot be made visible
 */
async function ensureElementVisible(selector: string): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	
	// Body is always visible
	if (selector === 'body') return true;
	
	// Check if element already exists and is visible
	let element = document.querySelector(selector);
	if (element && isElementVisible(element as HTMLElement)) {
		return true;
	}
	
	// Handle sidebar - ensure it's open
	if (selector === '[data-tour="sidebar"]') {
		const isMobile = get(mobile);
		if (!isMobile) {
			showSidebar.set(true);
			// Wait for sidebar to render
			await new Promise(resolve => setTimeout(resolve, 300));
			element = document.querySelector(selector);
			return element !== null && isElementVisible(element as HTMLElement);
		}
		// On mobile, sidebar might not be suitable for tour
		return false;
	}
	
	// For other elements, wait a bit and check again
	await new Promise(resolve => setTimeout(resolve, 100));
	element = document.querySelector(selector);
	return element !== null && isElementVisible(element as HTMLElement);
}

/**
 * Check if an element is actually visible (not just in DOM)
 */
function isElementVisible(element: HTMLElement): boolean {
	if (!element) return false;
	
	const style = window.getComputedStyle(element);
	if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
		return false;
	}
	
	// Check if element has dimensions
	const rect = element.getBoundingClientRect();
	if (rect.width === 0 && rect.height === 0) {
		return false;
	}
	
	return true;
}

// ============================================================================
// LocalStorage Helpers
// ============================================================================

/**
 * Load tour state from localStorage
 */
function loadTourState(): TourStorage | null {
	if (typeof window === 'undefined') return null;

	try {
		const stored = localStorage.getItem(TOUR_STORAGE_KEY);
		if (!stored) return null;

		const parsed = JSON.parse(stored) as TourStorage;

		// Validate version compatibility
		if (parsed.version !== TOUR_VERSION) {
			console.warn('Tour version mismatch, resetting tour state');
			return null;
		}

		return parsed;
	} catch (error) {
		console.error('Failed to load tour state:', error);
		return null;
	}
}

/**
 * Save tour state to localStorage
 */
function saveTourState(state: Partial<TourStorage>): void {
	if (typeof window === 'undefined') return;

	try {
		const current = loadTourState() || {
			completed: false,
			currentStep: 0,
			dismissedAt: null,
			version: TOUR_VERSION
		};

		const updated: TourStorage = {
			...current,
			...state,
			version: TOUR_VERSION
		};

		localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(updated));
	} catch (error) {
		console.error('Failed to save tour state:', error);
	}
}

/**
 * Clear tour state from localStorage
 */
function clearTourState(): void {
	if (typeof window === 'undefined') return;

	try {
		localStorage.removeItem(TOUR_STORAGE_KEY);
	} catch (error) {
		console.error('Failed to clear tour state:', error);
	}
}

// ============================================================================
// Tour Control Functions
// ============================================================================

/**
 * Initialize tour system and check if tour should be shown
 */
export function initTour(steps: TourStep[]): void {
	if (typeof window === 'undefined') return;

	// Store all steps without filtering - conditions will be checked when navigating
	tourSteps.set(steps);

	const stored = loadTourState();

	// Check if tour has been completed
	if (stored?.completed) {
		tourState.update((state) => ({
			...state,
			isCompleted: true,
			totalSteps: steps.length
		}));
		return;
	}

	// Check if user has incomplete tour progress
	if (stored && stored.currentStep > 0) {
		// Validate the saved step index
		const validStepIndex = Math.min(stored.currentStep, steps.length - 1);
		
		// Only show resume prompt if not recently dismissed (within last 24 hours)
		const recentlyDismissed = stored.dismissedAt && (Date.now() - stored.dismissedAt) < 24 * 60 * 60 * 1000;
		
		if (!recentlyDismissed) {
			// Offer to resume from last step
			resumeFromStep.set(validStepIndex);
			showResumePrompt.set(true);
			
			// Update tour state with total steps
			tourState.update((state) => ({
				...state,
				totalSteps: steps.length
			}));
			return;
		}
	}

	// Auto-start tour for first-time users (no stored state)
	if (!stored) {
		startTour();
	}
}

/**
 * Start the tour from the beginning or resume from saved position
 */
export async function startTour(): Promise<void> {
	const steps = get(tourSteps);
	if (steps.length === 0) {
		console.warn('Cannot start tour: no steps available');
		return;
	}

	const stored = loadTourState();
	let startIndex = stored?.currentStep || 0;

	// Find first valid step from startIndex (skip steps whose conditions aren't met or elements can't be made visible)
	while (startIndex < steps.length) {
		const step = steps[startIndex];
		
		// Check if step condition is met
		if (step.condition) {
			try {
				if (!step.condition()) {
					console.log(`Skipping step ${step.id}: condition not met`);
					startIndex++;
					continue;
				}
			} catch (error) {
				console.warn(`Tour step condition failed for ${step.id}:`, error);
				startIndex++;
				continue;
			}
		}
		
		// Ensure target element is visible
		const isVisible = await ensureElementVisible(step.target);
		if (!isVisible) {
			console.log(`Skipping step ${step.id}: target element cannot be made visible (${step.target})`);
			startIndex++;
			continue;
		}
		
		// Step is valid, break out of loop
		break;
	}

	// If no valid steps found, don't start tour
	if (startIndex >= steps.length) {
		console.warn('Cannot start tour: no valid steps available');
		return;
	}

	// Execute beforeStep callback if exists
	const firstStep = steps[startIndex];
	if (firstStep?.beforeStep) {
		try {
			firstStep.beforeStep();
		} catch (error) {
			console.error('Error executing beforeStep callback:', error);
		}
	}

	tourState.set({
		isActive: true,
		currentStepIndex: startIndex,
		totalSteps: steps.length,
		isCompleted: false,
		isPaused: false
	});

	showTour.set(true);

	// Save initial state
	saveTourState({
		currentStep: startIndex,
		completed: false
	});
}

/**
 * Move to the next step in the tour
 */
export async function nextStep(): Promise<void> {
	const state = get(tourState);
	const steps = get(tourSteps);

	if (!state.isActive || state.currentStepIndex >= state.totalSteps - 1) {
		return;
	}

	// Execute afterStep callback for current step
	const currentStepData = steps[state.currentStepIndex];
	if (currentStepData?.afterStep) {
		try {
			currentStepData.afterStep();
		} catch (error) {
			console.error('Error executing afterStep callback:', error);
		}
	}

	// Find next valid step (skip steps whose conditions aren't met or elements can't be made visible)
	let nextIndex = state.currentStepIndex + 1;
	while (nextIndex < steps.length) {
		const nextStepData = steps[nextIndex];
		
		// Check if step condition is met
		if (nextStepData.condition) {
			try {
				if (!nextStepData.condition()) {
					console.log(`Skipping step ${nextStepData.id}: condition not met`);
					nextIndex++;
					continue;
				}
			} catch (error) {
				console.warn(`Tour step condition failed for ${nextStepData.id}:`, error);
				nextIndex++;
				continue;
			}
		}
		
		// Ensure target element is visible
		const isVisible = await ensureElementVisible(nextStepData.target);
		if (!isVisible) {
			console.log(`Skipping step ${nextStepData.id}: target element cannot be made visible (${nextStepData.target})`);
			nextIndex++;
			continue;
		}
		
		// Step is valid, break out of loop
		break;
	}

	// If we've gone past the last step, complete the tour
	if (nextIndex >= steps.length) {
		completeTour();
		return;
	}

	// Execute beforeStep callback for next step
	const nextStepData = steps[nextIndex];
	if (nextStepData?.beforeStep) {
		try {
			nextStepData.beforeStep();
		} catch (error) {
			console.error('Error executing beforeStep callback:', error);
		}
	}

	tourState.update((s) => ({
		...s,
		currentStepIndex: nextIndex
	}));

	// Save progress
	saveTourState({
		currentStep: nextIndex
	});
}

/**
 * Move to the previous step in the tour
 */
export async function previousStep(): Promise<void> {
	const state = get(tourState);

	if (!state.isActive || state.currentStepIndex <= 0) {
		return;
	}

	const steps = get(tourSteps);
	
	// Find previous valid step (skip steps whose conditions aren't met or elements can't be made visible)
	let prevIndex = state.currentStepIndex - 1;
	while (prevIndex >= 0) {
		const prevStepData = steps[prevIndex];
		
		// Check if step condition is met
		if (prevStepData.condition) {
			try {
				if (!prevStepData.condition()) {
					console.log(`Skipping step ${prevStepData.id}: condition not met`);
					prevIndex--;
					continue;
				}
			} catch (error) {
				console.warn(`Tour step condition failed for ${prevStepData.id}:`, error);
				prevIndex--;
				continue;
			}
		}
		
		// Ensure target element is visible
		const isVisible = await ensureElementVisible(prevStepData.target);
		if (!isVisible) {
			console.log(`Skipping step ${prevStepData.id}: target element cannot be made visible (${prevStepData.target})`);
			prevIndex--;
			continue;
		}
		
		// Step is valid, break out of loop
		break;
	}

	// If we've gone before the first step, stay at current step
	if (prevIndex < 0) {
		return;
	}

	// Execute beforeStep callback for previous step
	const prevStepData = steps[prevIndex];
	if (prevStepData?.beforeStep) {
		try {
			prevStepData.beforeStep();
		} catch (error) {
			console.error('Error executing beforeStep callback:', error);
		}
	}

	tourState.update((s) => ({
		...s,
		currentStepIndex: prevIndex
	}));

	// Save progress
	saveTourState({
		currentStep: prevIndex
	});
}

/**
 * Skip/dismiss the tour
 */
export function skipTour(): void {
	const state = get(tourState);

	if (!state.isActive) {
		return;
	}

	tourState.set({
		...state,
		isActive: false,
		isPaused: false
	});

	showTour.set(false);

	// Save dismissal with current step (allows resume later)
	saveTourState({
		currentStep: state.currentStepIndex,
		dismissedAt: Date.now(),
		completed: false
	});
}

/**
 * Complete the tour
 */
export function completeTour(): void {
	const state = get(tourState);
	const steps = get(tourSteps);

	// Execute afterStep callback for last step
	const lastStep = steps[state.currentStepIndex];
	if (lastStep?.afterStep) {
		try {
			lastStep.afterStep();
		} catch (error) {
			console.error('Error executing afterStep callback:', error);
		}
	}

	tourState.set({
		...state,
		isActive: false,
		isCompleted: true,
		isPaused: false
	});

	showTour.set(false);

	// Save completion
	saveTourState({
		completed: true,
		currentStep: state.totalSteps - 1
	});
}

/**
 * Resume tour from saved position
 */
export async function resumeTour(): Promise<void> {
	const stored = loadTourState();

	if (!stored || stored.completed) {
		console.warn('Cannot resume tour: no saved progress or already completed');
		return;
	}

	const steps = get(tourSteps);
	if (steps.length === 0) {
		console.warn('Cannot resume tour: no steps available');
		return;
	}

	// Validate saved step index
	let resumeIndex = Math.min(stored.currentStep, steps.length - 1);

	// Find first valid step from resumeIndex (skip steps whose conditions aren't met or elements can't be made visible)
	while (resumeIndex < steps.length) {
		const resumeStep = steps[resumeIndex];
		
		// Check if step condition is met
		if (resumeStep.condition) {
			try {
				if (!resumeStep.condition()) {
					console.log(`Skipping step ${resumeStep.id}: condition not met`);
					resumeIndex++;
					continue;
				}
			} catch (error) {
				console.warn(`Tour step condition failed for ${resumeStep.id}:`, error);
				resumeIndex++;
				continue;
			}
		}
		
		// Ensure target element is visible
		const isVisible = await ensureElementVisible(resumeStep.target);
		if (!isVisible) {
			console.log(`Skipping step ${resumeStep.id}: target element cannot be made visible (${resumeStep.target})`);
			resumeIndex++;
			continue;
		}
		
		// Step is valid, break out of loop
		break;
	}

	// If no valid steps found, start from beginning
	if (resumeIndex >= steps.length) {
		console.warn('No valid resume step found, starting from beginning');
		await startTour();
		return;
	}

	const resumeStep = steps[resumeIndex];

	// Execute beforeStep callback
	if (resumeStep?.beforeStep) {
		try {
			resumeStep.beforeStep();
		} catch (error) {
			console.error('Error executing beforeStep callback:', error);
		}
	}

	tourState.set({
		isActive: true,
		currentStepIndex: resumeIndex,
		totalSteps: steps.length,
		isCompleted: false,
		isPaused: false
	});

	showTour.set(true);
	showResumePrompt.set(false);

	// Save that we're resuming (clear dismissedAt if it was set)
	saveTourState({
		currentStep: resumeIndex,
		completed: false,
		dismissedAt: null
	});
}

/**
 * Decline resume and start tour from beginning
 */
export function declineResume(): void {
	showResumePrompt.set(false);
	
	// Clear the saved progress
	clearTourState();
	
	// Start from the beginning
	startTour();
}

/**
 * Dismiss the resume prompt without starting tour
 */
export function dismissResumePrompt(): void {
	showResumePrompt.set(false);
	
	// Mark as dismissed
	saveTourState({
		dismissedAt: Date.now()
	});
}

/**
 * Restart tour from the beginning
 */
export function restartTour(): void {
	clearTourState();

	tourState.update((state) => ({
		...state,
		currentStepIndex: 0,
		isCompleted: false
	}));

	startTour();
}

/**
 * Reset tour progress (clear all saved data)
 */
export function resetTourProgress(): void {
	clearTourState();

	tourState.set(initialTourState);
	showTour.set(false);
}

/**
 * Check if tour has been completed
 */
export function isTourCompleted(): boolean {
	const stored = loadTourState();
	return stored?.completed || false;
}

/**
 * Pause the tour (hide but maintain state)
 */
export function pauseTour(): void {
	tourState.update((state) => ({
		...state,
		isPaused: true
	}));

	showTour.set(false);
}

/**
 * Unpause the tour (show again)
 */
export function unpauseTour(): void {
	const state = get(tourState);

	if (!state.isPaused) {
		return;
	}

	tourState.update((s) => ({
		...s,
		isPaused: false
	}));

	showTour.set(true);
}
