document.addEventListener('DOMContentLoaded', function () {
  pass
});

function isMobileScreen() {
  return window.innerWidth <= 850;
}

function updateLogoText() {
  const logoText = document.getElementById('logoText');
  if (isMobileScreen()) {
    logoText.innerHTML = 'HOY';
  } else {
    logoText.innerHTML = 'House of Young';
  }
}

updateLogoText();

function isTabletScreen() {
  return window.innerWidth <= 1100;
}

function isDesktopScreen() {
  return window.innerWidth > 1100;
}

window.addEventListener('resize', updateLogoText);
