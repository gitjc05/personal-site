const topbar = document.querySelector("[data-topbar]");
const cursorGlow = document.querySelector("[data-cursor-glow]");
const snowCanvas = document.querySelector("[data-snow]");
const snowVolumeControl = document.querySelector("[data-snow-volume]");
const navLinks = [...document.querySelectorAll(".primary-nav a")];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);
const sectionById = new Map(sections.map((section) => [section.id, section]));

const setTopbarState = () => {
  topbar?.classList.toggle("is-scrolled", window.scrollY > 18);
};

setTopbarState();
window.addEventListener("scroll", setTopbarState, { passive: true });

const setActiveNav = (targetId) => {
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${targetId}`);
  });
};

const clearActiveNav = () => {
  navLinks.forEach((link) => link.classList.remove("is-active"));
};

const updateActiveNav = () => {
  if (sections.length === 0) return;

  const firstSectionTop = sections[0].offsetTop;
  const probeY = window.scrollY + window.innerHeight * 0.34;
  const isAtPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8;

  if (!isAtPageEnd && probeY < firstSectionTop) {
    clearActiveNav();
    return;
  }

  let activeSection = sections[0];
  sections.forEach((section) => {
    if (section.offsetTop <= probeY) {
      activeSection = section;
    }
  });

  if (isAtPageEnd) {
    activeSection = sections[sections.length - 1];
  }

  setActiveNav(activeSection.id);
};

let navTicking = false;
const requestActiveNavUpdate = () => {
  if (navTicking) return;
  navTicking = true;
  window.requestAnimationFrame(() => {
    updateActiveNav();
    navTicking = false;
  });
};

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const targetId = link.getAttribute("href")?.slice(1);
    if (targetId && sectionById.has(targetId)) {
      setActiveNav(targetId);
      window.setTimeout(updateActiveNav, 420);
    }
  });
});

window.addEventListener("scroll", requestActiveNavUpdate, { passive: true });
window.addEventListener("resize", requestActiveNavUpdate);
window.addEventListener("hashchange", updateActiveNav);
updateActiveNav();

if (cursorGlow) {
  const coarsePointerQuery = window.matchMedia("(hover: none), (pointer: coarse)");
  let activeTouchPointer = null;

  const setGlowCoordinates = (x, y) => {
    document.documentElement.style.setProperty("--cursor-x", `${x}px`);
    document.documentElement.style.setProperty("--cursor-y", `${y}px`);
  };

  const setGlowPosition = (event) => {
    setGlowCoordinates(event.clientX, event.clientY);
  };

  const resetTouchGlow = () => {
    activeTouchPointer = null;
    cursorGlow.classList.remove("is-touching");
    document.documentElement.style.setProperty("--cursor-x", "50vw");
    document.documentElement.style.setProperty("--cursor-y", "40vh");
  };

  const endTouchGlow = (event) => {
    if (!coarsePointerQuery.matches || event.pointerType === "mouse") return;
    if (event.pointerId === activeTouchPointer) {
      resetTouchGlow();
    }
  };

  window.addEventListener(
    "pointerdown",
    (event) => {
      if (!coarsePointerQuery.matches || event.pointerType === "mouse") return;
      activeTouchPointer = event.pointerId;
      cursorGlow.classList.add("is-touching");
      setGlowPosition(event);
    },
    { passive: true }
  );

  window.addEventListener(
    "touchstart",
    (event) => {
      if (!coarsePointerQuery.matches || event.touches.length === 0) return;
      activeTouchPointer = "touch";
      cursorGlow.classList.add("is-touching");
      setGlowCoordinates(event.touches[0].clientX, event.touches[0].clientY);
    },
    { passive: true }
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!coarsePointerQuery.matches || event.pointerType === "mouse") {
        setGlowPosition(event);
        return;
      }

      if (event.pointerId === activeTouchPointer) {
        setGlowPosition(event);
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      if (!coarsePointerQuery.matches || activeTouchPointer === null || event.touches.length === 0) return;
      setGlowCoordinates(event.touches[0].clientX, event.touches[0].clientY);
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    (event) => {
      if (event.touches.length === 0) resetTouchGlow();
    },
    { passive: true }
  );

  window.addEventListener("touchcancel", resetTouchGlow, { passive: true });

  window.addEventListener("pointerup", endTouchGlow, { passive: true });
  window.addEventListener("pointercancel", endTouchGlow, { passive: true });
  window.addEventListener("pointerleave", () => {
    if (coarsePointerQuery.matches) {
      resetTouchGlow();
      return;
    }

    document.documentElement.style.setProperty("--cursor-x", "50vw");
    document.documentElement.style.setProperty("--cursor-y", "40vh");
  });
}

if (snowCanvas) {
  const context = snowCanvas.getContext("2d");
  const flakes = [];
  const settledSnow = [];
  const catchSnow = [];
  const catchTargets = [...document.querySelectorAll("[data-snow-catch]")].map((element) => ({
    element,
    rect: element.getBoundingClientRect(),
    cornerInset: 18
  }));
  const maxPixelRatio = 2;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motionFactor = reducedMotion ? 0.55 : 1;
  let snowVolume = snowVolumeControl ? Number(snowVolumeControl.value) / 100 : 0.34;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let lastFrame = performance.now();
  let lastScrollY = window.scrollY;
  let windPhase = 0;

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const createFlake = (startAbove = false) => ({
    x: Math.random() * width,
    y: startAbove ? randomBetween(-height, 0) : Math.random() * height,
    radius: randomBetween(0.9, 2.8),
    speed: randomBetween(34, 92) * motionFactor,
    sway: randomBetween(10, 34),
    drift: randomBetween(-10, 10),
    phase: Math.random() * Math.PI * 2,
    alpha: randomBetween(0.26, 0.68)
  });

  const getTargetFlakeCount = () => {
    if (snowVolume <= 0) return 0;
    const area = width * height;
    const density = 0.10 + snowVolume * 6.0;
    return Math.round(Math.min(1200, Math.max(24, (area / 11000) * density)));
  };

  const seedFlakes = () => {
    flakes.length = 0;
    const count = getTargetFlakeCount();
    for (let index = 0; index < count; index += 1) {
      flakes.push(createFlake(false));
    }
  };

  const syncFlakeCount = () => {
    const count = getTargetFlakeCount();

    if (flakes.length > count) {
      flakes.length = count;
      return;
    }

    while (flakes.length < count) {
      flakes.push(createFlake(true));
    }
  };

  const syncCatchRects = () => {
    catchTargets.forEach((target) => {
      target.rect = target.element.getBoundingClientRect();
      const borderRadius = Number.parseFloat(window.getComputedStyle(target.element).borderTopLeftRadius) || 0;
      target.cornerInset = borderRadius;
    });
  };

  const resizeSnow = (reset = false) => {
    const previousWidth = width;
    const previousHeight = height;
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;

    if (
      !reset &&
      nextWidth === width &&
      nextHeight === height &&
      nextPixelRatio === pixelRatio
    ) {
      syncCatchRects();
      return;
    }

    pixelRatio = nextPixelRatio;
    width = nextWidth;
    height = nextHeight;
    snowCanvas.width = Math.floor(width * pixelRatio);
    snowCanvas.height = Math.floor(height * pixelRatio);
    snowCanvas.style.width = `${width}px`;
    snowCanvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    if (previousWidth > 0 && previousWidth !== width) {
      const widthRatio = width / previousWidth;
      flakes.forEach((flake) => {
        flake.x *= widthRatio;
      });
      settledSnow.forEach((drift) => {
        drift.x *= widthRatio;
      });
    }

    if (previousHeight > 0 && previousHeight !== height) {
      const heightDelta = height - previousHeight;
      settledSnow.forEach((drift) => {
        drift.y += heightDelta;
      });
    }

    if (previousHeight > 0 && height < previousHeight) {
      flakes.forEach((flake) => {
        if (flake.y > height + flake.radius * 2) {
          Object.assign(flake, createFlake(true), { y: randomBetween(-80, -10) });
        }
      });
    }

    syncCatchRects();
    if (reset) {
      seedFlakes();
      settledSnow.length = 0;
      catchSnow.length = 0;
      return;
    }

    syncFlakeCount();
  };

  const addSettledSnow = (flake) => {
    settledSnow.push({
      x: flake.x,
      y: height - randomBetween(1, 9),
      radius: flake.radius * randomBetween(1.8, 3.4),
      alpha: flake.alpha * 0.78,
      age: 0,
      hold: randomBetween(2.8, 3.4),
      fade: randomBetween(0.55, 0.9)
    });

    if (settledSnow.length > 130) {
      settledSnow.shift();
    }
  };

  const addCatchSnow = (flake, target) => {
    const rect = target.rect;
    const localX = flake.x - rect.left;
    const radius = flake.radius * randomBetween(1.5, 2.6);
    const localY = -radius * randomBetween(0.58, 0.82);

    catchSnow.push({
      target,
      localX,
      localY,
      radius,
      alpha: flake.alpha * 0.95,
      age: 0,
      hold: randomBetween(3.4, 5.4),
      fade: randomBetween(0.55, 0.9)
    });

    if (catchSnow.length > 80) {
      catchSnow.shift();
    }
  };

  const findCatchTarget = (flake, previousY, delta, didScroll) => {
    if (didScroll) return undefined;

    return catchTargets.find((target) => {
      const rect = target.rect;
      const isVisible = rect.bottom > 0 && rect.top < height;
      const sideInset = target.cornerInset + flake.radius * 3;
      const bottomNow = flake.y + flake.radius;
      const bottomBefore = previousY + flake.radius;
      const landingWindow = Math.max(3, flake.speed * delta + 2);
      const withinX = flake.x >= rect.left + sideInset && flake.x <= rect.right - sideInset;
      const crossedTop = bottomBefore <= rect.top && bottomNow >= rect.top && bottomNow <= rect.top + landingWindow;
      return isVisible && withinX && crossedTop;
    });
  };

  const drawFlake = (flake, sway = 0) => {
    context.fillStyle = `rgba(232, 247, 255, ${flake.alpha})`;
    context.shadowBlur = 5;
    context.shadowColor = `rgba(232, 247, 255, ${flake.alpha * 0.45})`;
    context.beginPath();
    context.arc(flake.x + sway * 0.16, flake.y, flake.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  };

  const drawSnow = (now) => {
    const delta = Math.min((now - lastFrame) / 1000, 0.04);
    lastFrame = now;
    windPhase += delta * 0.45;
    const scrollY = window.scrollY;
    const didScroll = Math.abs(scrollY - lastScrollY) > 0.5;
    lastScrollY = scrollY;

    context.clearRect(0, 0, width, height);
    syncCatchRects();

    for (let index = settledSnow.length - 1; index >= 0; index -= 1) {
      const drift = settledSnow[index];
      drift.age += delta;

      if (drift.age > drift.hold) {
        drift.alpha -= delta / drift.fade;
      }

      if (drift.alpha < 0.01) {
        settledSnow.splice(index, 1);
        continue;
      }

      const gradient = context.createRadialGradient(drift.x, drift.y, 0, drift.x, drift.y, drift.radius);
      gradient.addColorStop(0, `rgba(219, 242, 255, ${drift.alpha})`);
      gradient.addColorStop(1, "rgba(219, 242, 255, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(drift.x, drift.y, drift.radius * 1.7, drift.radius * 0.55, 0, 0, Math.PI * 2);
      context.fill();
    }

    for (let index = catchSnow.length - 1; index >= 0; index -= 1) {
      const drift = catchSnow[index];
      drift.age += delta;
      const rect = drift.target.rect;

      if (drift.age > drift.hold) {
        drift.alpha -= delta / drift.fade;
      }

      if (drift.alpha < 0.01) {
        catchSnow.splice(index, 1);
        continue;
      }

      if (rect.bottom < 0 || rect.top > height) {
        continue;
      }

      const x = rect.left + drift.localX;
      const y = rect.top + drift.localY;
      const gradient = context.createRadialGradient(x, y, 0, x, y, drift.radius);
      gradient.addColorStop(0, `rgba(219, 242, 255, ${drift.alpha})`);
      gradient.addColorStop(1, "rgba(219, 242, 255, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(
        x,
        y,
        drift.radius * 1.45,
        drift.radius * 0.5,
        0,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    flakes.forEach((flake) => {
      const sway = Math.sin(windPhase + flake.phase + flake.y * 0.012) * flake.sway;
      const previousY = flake.y;
      flake.y += flake.speed * delta;
      flake.x += (flake.drift + sway * 0.08) * delta;

      if (flake.x < -24) flake.x = width + 24;
      if (flake.x > width + 24) flake.x = -24;

      const catchTarget = findCatchTarget(flake, previousY, delta, didScroll);

      if (catchTarget) {
        addCatchSnow(flake, catchTarget);
        Object.assign(flake, createFlake(true), { y: randomBetween(-80, -10) });
      } else if (flake.y > height - flake.radius * 2) {
        addSettledSnow(flake);
        Object.assign(flake, createFlake(true), { y: randomBetween(-80, -10) });
      }

      drawFlake(flake, sway);
    });

    window.requestAnimationFrame(drawSnow);
  };

  resizeSnow(true);
  window.addEventListener("resize", () => resizeSnow());
  window.addEventListener("scroll", syncCatchRects, { passive: true });

  snowVolumeControl?.addEventListener("input", () => {
    snowVolume = Number(snowVolumeControl.value) / 100;
    syncFlakeCount();
  });

  window.requestAnimationFrame(drawSnow);
}

const revealTargets = document.querySelectorAll(
  ".intro-grid, .scope-note, .system-card, .timeline-item, .role-visual, .project-card, .processor-copy, .scene-card, .life-strip > *, .contact-section > *"
);

revealTargets.forEach((target) => target.classList.add("reveal"));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14 }
);

revealTargets.forEach((target) => revealObserver.observe(target));
