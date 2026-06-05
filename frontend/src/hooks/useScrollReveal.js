import { useEffect } from 'react';

const REVEAL_SELECTOR = '[data-reveal]';

/**
 * Register scroll-based reveal animations for elements marked with the shared reveal attribute.
 */
const useScrollReveal = (routeKey) => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const registeredElements = new WeakSet();

    const applyDelay = (element) => {
      const delay = element.getAttribute('data-reveal-delay');

      if (delay) {
        element.style.setProperty('--reveal-delay', delay);
        return;
      }

      element.style.removeProperty('--reveal-delay');
    };

    const markVisibleImmediately = (root) => {
      root.querySelectorAll(REVEAL_SELECTOR).forEach((element) => {
        element.classList.remove('reveal-ready');
        element.classList.add('is-visible');
        applyDelay(element);
      });
    };

    if (prefersReducedMotion) {
      markVisibleImmediately(document);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    const registerElement = (element) => {
      if (!(element instanceof Element) || registeredElements.has(element)) {
        return;
      }

      registeredElements.add(element);
      applyDelay(element);
      element.classList.add('reveal-ready');
      element.classList.remove('is-visible');
      observer.observe(element);
    };

    const registerTree = (root) => {
      if (!root) {
        return;
      }

      if (root instanceof Element && root.matches(REVEAL_SELECTOR)) {
        registerElement(root);
      }

      if (root.querySelectorAll) {
        root.querySelectorAll(REVEAL_SELECTOR).forEach(registerElement);
      }
    };

    const firstFrameId = window.requestAnimationFrame(() => {
      registerTree(document.body);
    });
    const secondFrameId = window.requestAnimationFrame(() => {
      registerTree(document.body);
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
      observer.disconnect();
    };
  }, [routeKey]);
};

export default useScrollReveal;
