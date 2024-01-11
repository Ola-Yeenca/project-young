document.addEventListener('DOMContentLoaded', () => {
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  const canvas = document.getElementById('webgel');
  canvas.appendChild(renderer.domElement);

  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  const scene = new THREE.Scene();

  // Create particles
  const geometry = new THREE.BufferGeometry();
  const particlesCount = 5000;

  const positions = new Float32Array(particlesCount * 3);
  const colors = new Float32Array(particlesCount * 3);

  for (let i = 0; i < particlesCount; i++) {
    const i3 = i * 3;

    // Randomize initial positions
    positions[i3] = (Math.random() - 0.5) * 10;
    positions[i3 + 1] = (Math.random() - 0.5) * 10;
    positions[i3 + 2] = (Math.random() - 0.5) * 10;

    // Set initial colors to white
    colors[i3] = 1.0;
    colors[i3 + 1] = 1.0;
    colors[i3 + 2] = 1.0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.01,
    vertexColors: THREE.VertexColors,
  });

  const particlesMesh = new THREE.Points(geometry, material);
  scene.add(particlesMesh);

  // Create a moving sphere with a custom shader material for glowing effect
  const sphereGeometry = new THREE.SphereGeometry(0.5, 42, 32);

  const vertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `;

  const fragmentShader = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  void main() {
    float intensity = pow(dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
    gl_FragColor = vec4(glowColor, intensity);
  }
  `;

  const sphereMaterial = new THREE.ShaderMaterial({
    size: 2,
    uniforms: {
      glowColor: { value: new THREE.Color(0xFDB813) },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphereMesh.scale.set(5, 5, 4, 3);
  scene.add(sphereMesh);

  // Set up camera position and look-at
  camera.position.set(0, 0, 5);
  camera.lookAt(scene.position);

  // Function to handle scroll events and render the WebGL scene
  const handleScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    const normalizedScroll = scrollY / window.innerHeight;

    // Adjust camera position based on scroll
    camera.position.z = 5 + normalizedScroll * 5;

    // Render the scene
    renderer.render(scene, camera);
  };

  // Add scroll event listener
  window.addEventListener('scroll', handleScroll, { passive: true });

  // Initial render
  handleScroll();

  const animate = () => {
    requestAnimationFrame(animate);

    // Rotate particles based on mouse movement
    particlesMesh.rotation.x += 0.005 * (mouseY - particlesMesh.rotation.x);
    particlesMesh.rotation.y += 0.005 * (mouseX - particlesMesh.rotation.y);

    // Set up a linear speed (distance covered per second)
    const linearSpeed = 1.0; // Adjust as needed

    // Move the sphere on a linear line
    const time = Date.now() * 0.001;
    const radius = 0.9;

    // Calculate the linear distance covered based on time and speed
    const linearDistance = time * linearSpeed;

    sphereMesh.position.x = Math.cos(linearDistance) * radius;
    sphereMesh.position.y = Math.sin(linearDistance) * radius;

    // Update particle positions continuously
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < particlesCount; i++) {
      const i3 = i * 2;

      // Update particle positions over time
      positions[i3] += (Math.random() - 0.5) * 0.01;
      positions[i3 + 1] += (Math.random() - 0.5) * 0.01;
      positions[i3 + 2] += (Math.random() - 0.5) * 0.01;
    }

    // Ensure the colors array is properly set (assuming you want them white)
    const colors = geometry.attributes.color.array;
    for (let i = 0; i < particlesCount; i++) {
      const i3 = i * 3;
      colors[i3] = 1.0;
      colors[i3 + 1] = 1.0;
      colors[i3 + 2] = 1.0;
    }

    // Update both position and color buffers
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    renderer.render(scene, camera);
  };

  let mouseX = 0;
  let mouseY = 0;

  window.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  });

  animate();

});
