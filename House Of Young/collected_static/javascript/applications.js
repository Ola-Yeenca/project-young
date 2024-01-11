document.addEventListener('DOMContentLoaded', function () {
  const content = document.querySelector('.content');
  const contentTitle = document.querySelector('.content__title');
  const contentPara = document.querySelector('.content__para');

  const tl = gsap.timeline();

  tl.fromTo(
    content,
    { scaleX: 0 },
    {
      delay: 0.5,
      duration: 4,
      scaleX: 1,
      onComplete: function () {
        content.style.transformOrigin = 'right';
      },
    }
  );

  tl.to(
    contentTitle,
    {
      duration: 2,
      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
    },
    '-=3'
  );

  tl.to(
    contentPara,
    {
      duration: 1,
      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
    },
    '-=2'
  );
});
