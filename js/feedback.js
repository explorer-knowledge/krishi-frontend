document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const session = window.getSession ? window.getSession() : null;

    const formContainer = document.getElementById('feedback-form-container');
    const loginPrompt = document.getElementById('feedback-login-prompt');

    if (session) {
        // User is logged in, show the form
        if (formContainer) formContainer.style.display = 'block';
        if (loginPrompt) loginPrompt.style.display = 'none';
    } else {
        // User is not logged in, show the login prompt
        if (formContainer) formContainer.style.display = 'none';
        if (loginPrompt) loginPrompt.style.display = 'block';
    }
});

async function submitFeedback(event) {
    event.preventDefault();
    
    const session = window.getSession ? window.getSession() : null;
    if (!session) {
        alert("You must be logged in to submit feedback.");
        return;
    }

    const rating = document.getElementById('feedback-rating').value;
    const message = document.getElementById('feedback-message').value;
    const btn = document.getElementById('feedback-submit-btn');
    const statusDiv = document.getElementById('feedback-status');

    if (!message.trim()) {
        statusDiv.textContent = "Please enter a message.";
        statusDiv.style.color = "red";
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    statusDiv.textContent = "";

    try {
        const response = await fetch(`${API_BASE}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mobile: session.mobile,
                message: message,
                rating: parseInt(rating)
            })
        });

        const data = await response.json();

        if (data.success) {
            statusDiv.textContent = "Thank you! Your feedback has been submitted.";
            statusDiv.style.color = "green";
            document.getElementById('feedback-form').reset();
        } else {
            statusDiv.textContent = data.error || "Failed to submit feedback. Please try again.";
            statusDiv.style.color = "red";
        }
    } catch (err) {
        console.error("Feedback submit error:", err);
        statusDiv.textContent = "An error occurred. Please check your connection.";
        statusDiv.style.color = "red";
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Submit Feedback';
    }
}
