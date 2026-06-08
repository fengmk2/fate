<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

type FrameworkContent = {
  details: string;
  icon: string;
  link: string;
  linkText: string;
  title: string;
  word: string;
};

const frameworks: Array<FrameworkContent> = [
  {
    details:
      'fate uses modern Async React features like Actions, Suspense, and `use` for a seamless user experience. Optimistic updates enable instant UI feedback and rollbacks are handled automatically.',
    icon: '⚛️',
    link: '/guide/actions',
    linkText: 'Actions in fate',
    title: 'Async React',
    word: 'React',
  },
  {
    details:
      'fate brings the same view model to Vue with composables, resources, Suspense, and a reactive FateClient provider.',
    icon: '💚',
    link: '/guide/vue',
    linkText: 'Vue guide',
    title: 'Vue Native',
    word: 'Vue',
  },
];

let activeIndex = 0;
let interval: ReturnType<typeof globalThis.setInterval> | null = null;
let mediaQuery: MediaQueryList | null = null;
let wordElement: HTMLElement | null = null;
let currentWordElement: HTMLElement | null = null;
let nextWordElement: HTMLElement | null = null;
let featureBoxElement: HTMLElement | null = null;
let featureElement: HTMLElement | null = null;
let featureSettleFrame: ReturnType<typeof globalThis.requestAnimationFrame> | null = null;
let swapTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
let wordSettleFrame: ReturnType<typeof globalThis.requestAnimationFrame> | null = null;

const removeFeatureGhosts = () => {
  featureElement
    ?.querySelectorAll<HTMLElement>('.fate-home-feature-ghost')
    .forEach((element) => element.remove());
};

const clearSwap = () => {
  if (swapTimeout) {
    globalThis.clearTimeout(swapTimeout);
    swapTimeout = null;
  }

  if (featureSettleFrame) {
    globalThis.cancelAnimationFrame(featureSettleFrame);
    featureSettleFrame = null;
  }

  if (wordSettleFrame) {
    globalThis.cancelAnimationFrame(wordSettleFrame);
    wordSettleFrame = null;
  }

  wordElement?.classList.remove('fate-home-word-swapping');
  wordElement?.classList.remove('fate-home-word-settling');
  featureElement?.classList.remove('fate-home-feature-in');
  featureElement?.classList.remove('fate-home-feature-out');
  featureElement?.classList.remove('fate-home-feature-settling');
  removeFeatureGhosts();
  if (nextWordElement) {
    nextWordElement.textContent = '';
  }
};

const prepareFeatureSwap = () => {
  const ghost = featureBoxElement!.cloneNode(true) as HTMLElement;
  ghost.classList.remove('fate-home-feature-content');
  ghost.classList.add('fate-home-feature-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  featureElement!.append(ghost);
  featureElement!.classList.add('fate-home-feature-in');
  featureElement!.classList.add('fate-home-feature-settling');
};

const startSwap = (onComplete: () => void) => {
  // Force the below-start state to apply before the incoming transition starts.
  const featureHeight = featureElement!.offsetHeight;
  if (featureHeight < 0) {
    return;
  }
  featureSettleFrame = globalThis.requestAnimationFrame(() => {
    wordElement?.classList.add('fate-home-word-swapping');
    featureElement?.classList.remove('fate-home-feature-settling');
    featureElement?.classList.remove('fate-home-feature-in');
    featureElement?.classList.add('fate-home-feature-out');
    featureSettleFrame = null;
    swapTimeout = globalThis.setTimeout(onComplete, 260);
  });
};

const finishFeatureSwap = () => {
  featureElement?.classList.remove('fate-home-feature-out');
  removeFeatureGhosts();
};

const settleWordSwap = () => {
  wordElement!.classList.add('fate-home-word-settling');
  wordElement!.classList.remove('fate-home-word-swapping');
  nextWordElement!.textContent = '';
  // Force the no-transition state to apply before transitions are restored.
  const wordHeight = wordElement!.offsetHeight;
  if (wordHeight < 0) {
    return;
  }
  wordSettleFrame = globalThis.requestAnimationFrame(() => {
    wordElement?.classList.remove('fate-home-word-settling');
    wordSettleFrame = null;
  });
};

const updateLinkText = (linkText: HTMLElement, value: string) => {
  const firstTextNode = Array.from(linkText.childNodes).find(
    (node) => node.nodeType === globalThis.Node.TEXT_NODE,
  );

  if (firstTextNode) {
    firstTextNode.textContent = `${value} `;
  } else {
    linkText.prepend(globalThis.document.createTextNode(`${value} `));
  }
};

const updateFramework = (content: FrameworkContent, animated = true) => {
  if (
    !wordElement ||
    !currentWordElement ||
    !nextWordElement ||
    !featureBoxElement ||
    !featureElement
  ) {
    return;
  }

  const updateWord = () => {
    currentWordElement!.textContent = content.word;
  };

  const updateFeature = () => {
    featureElement!.setAttribute('href', content.link);
    featureBoxElement!.querySelector<HTMLElement>('.icon')!.textContent = content.icon;
    featureBoxElement!.querySelector<HTMLElement>('.title')!.textContent = content.title;
    featureBoxElement!.querySelector<HTMLElement>('.details')!.textContent = content.details;
    updateLinkText(
      featureBoxElement!.querySelector<HTMLElement>('.link-text-value')!,
      content.linkText,
    );
  };

  if (!animated) {
    clearSwap();
    updateWord();
    updateFeature();
    return;
  }

  clearSwap();

  nextWordElement.textContent = content.word;
  prepareFeatureSwap();
  updateFeature();
  startSwap(() => {
    updateWord();
    settleWordSwap();
    finishFeatureSwap();
    swapTimeout = null;
  });
};

const stopInterval = () => {
  if (interval) {
    globalThis.clearInterval(interval);
    interval = null;
  }
};

const startInterval = () => {
  if (interval || mediaQuery?.matches) {
    return;
  }

  interval = globalThis.setInterval(() => {
    activeIndex = (activeIndex + 1) % frameworks.length;
    updateFramework(frameworks[activeIndex]);
  }, 3200);
};

const updateMotionPreference = () => {
  wordElement!.classList.toggle('fate-home-word-reduced', Boolean(mediaQuery?.matches));

  if (mediaQuery?.matches) {
    stopInterval();
    clearSwap();
    currentWordElement!.textContent = 'React and Vue';
    nextWordElement!.textContent = '';
    return;
  }

  updateFramework(frameworks[activeIndex], false);
  startInterval();
};

onMounted(() => {
  activeIndex = 0;
  stopInterval();

  const heading = globalThis.document.querySelector<HTMLElement>('.VPHero .heading .text');
  featureElement = globalThis.document.querySelector<HTMLElement>(
    '.VPFeatures .item:last-child .VPFeature',
  );

  if (!heading || !featureElement) {
    return;
  }

  featureBoxElement = featureElement.querySelector<HTMLElement>('.box');

  if (!featureBoxElement) {
    return;
  }

  featureBoxElement.classList.add('fate-home-feature-content');

  heading.setAttribute('aria-label', 'A modern data client for React and Vue');
  heading.innerHTML =
    'A modern data client for <span class="fate-home-word" aria-hidden="true"><span class="fate-home-word-current">React</span><span class="fate-home-word-next"></span></span>';
  wordElement = heading.querySelector<HTMLElement>('.fate-home-word');
  currentWordElement = heading.querySelector<HTMLElement>('.fate-home-word-current');
  nextWordElement = heading.querySelector<HTMLElement>('.fate-home-word-next');

  mediaQuery = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', updateMotionPreference);
  updateMotionPreference();
});

onBeforeUnmount(() => {
  stopInterval();
  clearSwap();
  mediaQuery?.removeEventListener('change', updateMotionPreference);
});
</script>

<template>
  <span class="fate-home-rotator" aria-hidden="true" />
</template>
