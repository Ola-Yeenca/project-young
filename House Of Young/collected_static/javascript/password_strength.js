document.addEventListener('DOMContentLoaded', () => {
  // password_strength_meter.js
$(document).ready(function () {
  var passwordInput = $('#password');
  var meter = $('#password-strength-meter');

  passwordInput.on('input', function () {
    var password = passwordInput.val();
    var result = zxcvbn(password);

    // Update the meter with the password strength
    meter.html('Password strength: ' + result.score + '/4');

    // You can customize the styling based on the password strength if needed
    switch (result.score) {
      case 0:
      case 1:
        meter.css('color', 'red');
        break;
      case 2:
        meter.css('color', 'orange');
        break;
      case 3:
        meter.css('color', 'yellow');
        break;
      case 4:
        meter.css('color', 'green');
        break;
      default:
        meter.css('color', 'black');
    }
  });
});

})
