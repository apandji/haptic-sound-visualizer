/**
 * Two-step Test Setup flow: Step 1 = What to run (library + queue), Step 2 = Session details & start.
 * Depends on: state.js (queue), DOM elements #setupStep1, #setupStep2, #setupContinueBtn, #setupBackBtn.
 * Call initSetupSteps() after queue and sessionInfo are created (e.g. end of initializeComponents).
 */
(function () {
    const STEP_1 = 1;
    const STEP_2 = 2;

    let continueBtn = null;
    let backBtn = null;
    let step1El = null;
    let step2El = null;
    let layoutEl = null;

    function getSetupStep() {
        if (step1El && step1El.classList.contains('is-active')) return STEP_1;
        if (step2El && step2El.classList.contains('is-active')) return STEP_2;
        return STEP_1;
    }

    function goToStep(step) {
        if (!step1El || !step2El) return;
        if (step === STEP_1) {
            if (layoutEl) layoutEl.classList.remove('is-step-2');
            step1El.classList.add('is-active');
            step2El.classList.remove('is-active');
        } else {
            if (layoutEl) layoutEl.classList.add('is-step-2');
            step1El.classList.remove('is-active');
            step2El.classList.add('is-active');
        }
    }

    function updateContinueButton() {
        if (!continueBtn) return;
        const count = typeof queue !== 'undefined' && queue && typeof queue.getItems === 'function'
            ? queue.getItems().length
            : 0;
        continueBtn.disabled = count < 1;
        continueBtn.title = count < 1 ? 'Add at least one pattern to the queue to continue' : 'Continue to session details';
    }

    function initSetupSteps() {
        layoutEl = document.getElementById('setupLayout');
        step1El = document.getElementById('setupStep1');
        step2El = document.getElementById('setupStep2');
        continueBtn = document.getElementById('setupContinueBtn');
        backBtn = document.getElementById('setupBackBtn');

        if (!step1El || !step2El || !continueBtn || !backBtn) return;

        updateContinueButton();

        continueBtn.addEventListener('click', function () {
            const count = typeof queue !== 'undefined' && queue && typeof queue.getItems === 'function'
                ? queue.getItems().length
                : 0;
            if (count >= 1) goToStep(STEP_2);
        });

        backBtn.addEventListener('click', function () {
            goToStep(STEP_1);
        });
    }

    window.initSetupSteps = initSetupSteps;
    window.updateSetupStepContinueButton = updateContinueButton;
    window.getSetupStep = getSetupStep;
    window.goToSetupStep = goToStep;
})();
