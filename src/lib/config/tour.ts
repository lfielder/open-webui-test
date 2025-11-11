import type { TourStep } from '$lib/stores/tour';

// ============================================================================
// Tour Steps Configuration
// ============================================================================

export const TOUR_STEPS: TourStep[] = [
	{
		id: 'welcome',
		title: 'Welcome to Open WebUI',
		content:
			"Let's take a quick tour to help you get started. This tour will show you the key features of Open WebUI. You can skip at any time by clicking 'Skip Tour' or pressing Escape.",
		target: 'body',
		placement: 'center'
	},
	{
		id: 'sidebar',
		title: 'Chat History & Navigation',
		content:
			'This is your sidebar. Here you can access previous conversations, create new chats, search your history, and organize chats into folders. Your conversations are saved automatically.',
		target: '[data-tour="sidebar"]',
		placement: 'right'
	},
	{
		id: 'model-selector',
		title: 'Choose Your AI Model',
		content:
			'Click here to select from available AI models. Each model has different capabilities and strengths. Try different models to find what works best for your needs.',
		target: '[data-tour="model-selector"]',
		placement: 'bottom'
	},
	{
		id: 'complete',
		title: "You're All Set!",
		content:
			"You're ready to start chatting! Type your message in the input area below to begin a conversation. Explore the sidebar for settings, document uploads, and more features. Enjoy using Open WebUI!",
		target: 'body',
		placement: 'center'
	}
];

// ============================================================================
// Tour Configuration Settings
// ============================================================================

export const TOUR_CONFIG = {
	/**
	 * Auto-start tour for first-time users
	 */
	autoStart: true,

	/**
	 * Show progress indicator (step X of Y)
	 */
	showProgress: true,

	/**
	 * Allow users to skip the tour
	 */
	allowSkip: true,

	/**
	 * Enable keyboard navigation
	 */
	allowKeyboardNav: true,

	/**
	 * Padding around highlighted element (in pixels)
	 */
	spotlightPadding: 8,

	/**
	 * Border radius of spotlight (in pixels)
	 */
	spotlightRadius: 12,

	/**
	 * Animation/transition duration (in milliseconds)
	 */
	animationDuration: 300,

	/**
	 * Backdrop opacity (0-1)
	 */
	backdropOpacity: 0.7,

	/**
	 * Z-index for tour overlay
	 */
	zIndex: 9999,

	/**
	 * Scroll behavior when highlighting elements
	 */
	scrollBehavior: 'smooth' as ScrollBehavior,

	/**
	 * Offset from target element for tooltip positioning (in pixels)
	 */
	tooltipOffset: 16,

	/**
	 * Maximum width of tooltip (in pixels)
	 */
	tooltipMaxWidth: 400,

	/**
	 * Minimum touch target size for mobile (in pixels)
	 */
	minTouchTarget: 44,

	/**
	 * Debounce delay for resize/scroll handlers (in milliseconds)
	 */
	debounceDelay: 150,

	/**
	 * Scroll debounce delay (in milliseconds) - shorter for better responsiveness
	 */
	scrollDebounceDelay: 100,

	/**
	 * Enable focus trap within tour UI
	 */
	enableFocusTrap: true,

	/**
	 * Restore focus to trigger element on tour close
	 */
	restoreFocus: true
};

// ============================================================================
// Responsive Breakpoints
// ============================================================================

export const TOUR_BREAKPOINTS = {
	mobile: 640,
	tablet: 768,
	desktop: 1024
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get responsive configuration based on viewport width
 */
export function getResponsiveConfig(): {
	isMobile: boolean;
	isTablet: boolean;
	isDesktop: boolean;
	tooltipMaxWidth: number;
	spotlightPadding: number;
} {
	if (typeof window === 'undefined') {
		return {
			isMobile: false,
			isTablet: false,
			isDesktop: true,
			tooltipMaxWidth: TOUR_CONFIG.tooltipMaxWidth,
			spotlightPadding: TOUR_CONFIG.spotlightPadding
		};
	}

	const width = window.innerWidth;
	const isMobile = width < TOUR_BREAKPOINTS.mobile;
	const isTablet = width >= TOUR_BREAKPOINTS.mobile && width < TOUR_BREAKPOINTS.tablet;
	const isDesktop = width >= TOUR_BREAKPOINTS.tablet;

	return {
		isMobile,
		isTablet,
		isDesktop,
		tooltipMaxWidth: isMobile
			? Math.min(width * 0.9, 360)
			: isTablet
				? 360
				: TOUR_CONFIG.tooltipMaxWidth,
		spotlightPadding: isMobile ? 6 : isTablet ? 8 : TOUR_CONFIG.spotlightPadding
	};
}

/**
 * Check if a tour step's condition is met
 */
export function isStepAvailable(step: TourStep): boolean {
	if (!step.condition) {
		return true;
	}

	try {
		return step.condition();
	} catch (error) {
		console.warn(`Tour step condition check failed for ${step.id}:`, error);
		return false;
	}
}

/**
 * Get filtered tour steps based on current conditions
 */
export function getAvailableSteps(): TourStep[] {
	return TOUR_STEPS.filter(isStepAvailable);
}

/**
 * Get tour step by ID
 */
export function getTourStepById(id: string): TourStep | undefined {
	return TOUR_STEPS.find((step) => step.id === id);
}

/**
 * Get total number of available steps
 */
export function getTotalSteps(): number {
	return getAvailableSteps().length;
}
