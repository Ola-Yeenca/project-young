document.addEventListener('DOMContentLoaded', () => {
  console.log("Accounts js loaded");

  document.querySelector('#login-form').onsubmit = async (event) => {
    event.preventDefault(); 

    const email = document.querySelector('#id_email').value;
    const password = document.querySelector('#id_password').value;

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': document.querySelector('input[name="csrfmiddlewaretoken"]').value,
        },
        body: new URLSearchParams({
          email: email,
          password: password
        }),
      });

      const result = await response.json();

      console.log(result);

      if (result.error) {
        document.querySelector('#message').innerHTML = result.error;
      } else {
        document.querySelector('#message').innerHTML = 'Logged in successfully';
      }

    } catch (error) {
      console.error('Error during login:', error);
      document.querySelector('#message').innerHTML = "An unexpected error occurred while trying to log you in. Please try again later.";
    }
  };
});
