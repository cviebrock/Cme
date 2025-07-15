// {{{ CMEQuizPage()

function CMEQuizPage(el, response_server, current_question) {
  this.el = YAHOO.util.Dom.get(el);
  this.response_server = response_server;
  this.current_question = current_question;
  this.dialog_question = null;
  this.dialog_question_index = null;
  this.is_submitted = false;
  this.dialog = null;

  YAHOO.util.Event.onDOMReady(
    function () {
      this.initQuestions();
      this.initKeyboardEvents();

      this.draw();

      this.current_page = 'intro';
      this.updateIntroPage();

      this.setPage(this.current_page, true);
      this.setQuestion(this.current_question, true);
    },
    this,
    true
  );
}

// }}}

CMEQuizPage.resize_period = 0.1; // seconds
CMEQuizPage.fade_period = 0.15; // seconds
CMEQuizPage.saving_fade_period = 0.5; // seconds
CMEQuizPage.dialog_fade_period = 0.25; // seconds

CMEQuizPage.start_text = 'Start Quiz';
CMEQuizPage.continue_text = 'Continue Quiz';
CMEQuizPage.next_text = 'Next Question';
CMEQuizPage.previous_text = 'Previous Question';
CMEQuizPage.quiz_status_text = 'Question %s of %s';
CMEQuizPage.submit_text = 'Submit Quiz';
CMEQuizPage.review_text = 'Review Answers';
CMEQuizPage.intro_text = 'Return to Introduction';
CMEQuizPage.close_text = 'Close';
CMEQuizPage.question_title_text = 'Question %s';
CMEQuizPage.change_text = 'Change';
CMEQuizPage.answer_text = 'Answer';

CMEQuizPage.intro_status_review_text = '%s of %s questions completed';
CMEQuizPage.intro_status_start_text = '%s questions, about %s';
CMEQuizPage.intro_status_continue_text =
  '%s of %s questions completed, ' + 'about %s remaining';

CMEQuizPage.review_status_text_0 = 'All questions are answered.';
CMEQuizPage.review_status_text_1 = '%s is not answered.';
CMEQuizPage.review_status_text_2_to_5 = '%s are unanswered.';
CMEQuizPage.review_status_text_many = '%s questions are unanswered.';
CMEQuizPage.review_status_required_text =
  'All questions must be ' + 'answered before the quiz can ' + 'be submitted.';

CMEQuizPage.hours_text_1 = 'one hour';
CMEQuizPage.hours_text_many = '%s hours';
CMEQuizPage.minutes_text_many = '%s minutes';

(function () {
  var Dom = YAHOO.util.Dom;
  var Event = YAHOO.util.Event;
  var Easing = YAHOO.util.Easing;
  var Anim = YAHOO.util.Anim;
  var Connect = YAHOO.util.Connect;
  var JSON = YAHOO.lang.JSON;

  var proto = CMEQuizPage.prototype;

  var is_touch_device = 'ontouchstart' in document.documentElement;

  // {{{ initQuestions()

  proto.initQuestions = function () {
    this.question_options = [];
    this.question_labels = [];
    this.question_fields = [];
    this.question_option_messages = {};
    this.question_review_answers = [];

    this.question_container = Dom.getElementsByClassName(
      'quiz-question-container',
      'div',
      this.el
    )[0];

    this.question_els = Dom.getElementsByClassName(
      'question',
      'div',
      this.question_container,
      function (el) {
        el.style.display = 'none';
      }
    );

    var list, form_field;

    for (var i = 0; i < this.question_els.length; i++) {
      form_field = Dom.getNextSibling(Dom.getFirstChild(this.question_els[i]));

      list = Dom.getFirstChild(Dom.getFirstChild(form_field));

      this.question_options.push(
        Dom.getElementsBy(
          function (n) {
            return n.name === list.id && n.type === 'radio';
          },
          'input',
          list,
          function (n) {
            var li = Dom.getAncestorByTagName(n, 'li');

            // add radio button click handlers
            var that = this;
            (function () {
              var index = i;
              Event.on(
                n,
                'click',
                function (e) {
                  Event.stopPropagation(e);
                  that.saveResponseValue(n, index);
                },
                that,
                true
              );
            })();

            // initialize selected option
            if (n.checked) {
              Dom.addClass(li, 'selected');
            }

            var message = document.createElement('span');
            message.className = 'question-saved-message';
            message.appendChild(document.createTextNode(''));
            li.insertBefore(message, n.parentNode.nextSibling);
            this.question_option_messages[n.id] = message;

            // add list hover actions
            Event.on(li, 'mouseover', function (e) {
              Dom.addClass(li, 'hover');
            });

            Event.on(li, 'mouseout', function (e) {
              Dom.removeClass(li, 'hover');
            });

            // add list click actions
            Event.on(
              li,
              'click',
              function (e) {
                Event.stopEvent(e);
                n.click();
              },
              this,
              true
            );
          },
          this,
          true
        )
      );

      this.question_labels.push(
        Dom.getElementsBy(
          function (n) {
            return Dom.hasClass(n, 'swat-control');
          },
          'label',
          list
        )
      );

      this.question_fields.push(form_field);
    }

    this.total_questions = this.question_els.length;
  };

  // }}}

  // keyboard handler
  // {{{ initKeyboardEvents()

  proto.initKeyboardEvents = function () {
    Event.on(
      document,
      'keydown',
      function (e) {
        var target = Event.getTarget(e);

        // don't capture keyboard events for inputs outside of the quiz
        if (
          (target.tagName.toLowerCase() === 'textarea' ||
            target.tagName.toLowerCase() === 'input') &&
          Dom.getAncestorByClassName(target, 'quiz-page') === null &&
          Dom.getAncestorByClassName(target, 'quiz-question-dialog') === null
        ) {
          return;
        }

        this.handleKeyboardEvent(e);
      },
      this,
      true
    );
  };

  // }}}
  // {{{ handleKeyboardEvent()

  proto.handleKeyboardEvent = function (e) {
    switch (Event.getCharCode(e)) {
      case 13: // enter
      case 39: // right
        if (this.current_page === 'intro') {
          this.startQuiz();
        } else if (this.dialog_question === null) {
          this.nextQuestion();
        } else if (Event.getCharCode(e) === 13) {
          this.closeDialog();
        }

        this.stopKeyboardEvent(e);

        break;
      case 37: // left
        if (this.dialog_question === null) {
          this.previousQuestion();
        }

        this.stopKeyboardEvent(e);
        break;
      case 49: // 1
      case 65: // a
        this.selectOption(0);
        this.stopKeyboardEvent(e);
        break;
      case 50: // 2
      case 66: // b
        this.selectOption(1);
        this.stopKeyboardEvent(e);
        break;
      case 51: // 3
      case 67: // c
        this.selectOption(2);
        this.stopKeyboardEvent(e);
        break;
      case 52: // 4
      case 68: // d
        this.selectOption(3);
        this.stopKeyboardEvent(e);
        break;
      case 53: // 5
      case 69: // e
        this.selectOption(4);
        this.stopKeyboardEvent(e);
        break;
      case 54: // 6
      case 70: // f
        this.selectOption(5);
        this.stopKeyboardEvent(e);
        break;
      case 55: // 7
      case 71: // g
        this.selectOption(6);
        this.stopKeyboardEvent(e);
        break;
    }
  };

  // }}}
  // {{{ stopKeyboardEvent()

  proto.stopKeyboardEvent = function (e) {
    // stop events on the question radio list to prevent left/right events
    // from switching which radio button is selected. Also prevents Firefox
    // from performing inline searching
    var target = Event.getTarget(e);
    if (
      target.tagName.toLowerCase() === 'input' &&
      (Dom.getAncestorByClassName(target, 'quiz-page') !== null ||
        Dom.getAncestorByClassName(target, 'quiz-question-dialog') !== null)
    ) {
      Event.stopEvent(e);
    }
  };

  // }}}

  // draw
  // {{{ draw()

  proto.draw = function () {
    var form = Dom.getAncestorByTagName(this.el, 'form');

    this.page_container = document.createElement('div');
    this.page_container.className = 'quiz-page-container';

    form.appendChild(this.page_container);

    this.pages = {
      review: this.drawReviewPage(),
      quiz: this.drawQuizPage(),
      intro: this.drawIntroPage()
    };

    this.page_container.appendChild(this.pages.intro);
    this.page_container.appendChild(this.pages.quiz);
    this.page_container.appendChild(this.pages.review);

    this.drawDialog();
  };

  // }}}
  // {{{ drawIntroPage()

  proto.drawIntroPage = function () {
    var started = false;
    for (var i = 0; i < this.question_els.length; i++) {
      if (this.validate(i)) {
        started = true;
        break;
      }
    }

    var last_completed = this.validate(this.question_els.length - 1);

    var page = document.getElementById('quiz_info');
    Dom.addClass(page, 'quiz-page quiz-page-intro');

    var footer = document.createElement('div');
    footer.className = 'quiz-intro-footer';

    this.continue_button = document.createElement('input');
    this.continue_button.setAttribute('type', 'button');
    this.continue_button.className = 'btn btn-primary quiz-button-continue';

    if (!started) {
      this.continue_button.value = CMEQuizPage.start_text;
    } else if (last_completed) {
      this.continue_button.value = CMEQuizPage.review_text;
    } else {
      this.continue_button.value = CMEQuizPage.continue_text;
    }

    Event.on(
      this.continue_button,
      'click',
      function (e) {
        Event.preventDefault(e);

        if (!started && typeof amplitude !== 'undefined') {
          amplitude.track('CME_Quiz_Started', {
            episode_id: CMEQuizPage.episode_id
          });
        }

        var last_completed = this.validate(this.question_els.length - 1);
        var current_completed = this.validate(this.current_question);

        var completed = 0;
        for (var i = 0; i < this.question_els.length; i++) {
          if (this.validate(i)) {
            completed++;
          }
        }

        if (
          completed === this.total_questions ||
          (current_completed && last_completed)
        ) {
          this.updateReviewPage();
          this.setPageWithAnimation('review');
        } else {
          this.setPageWithAnimation('quiz');
        }
      },
      this,
      true
    );

    footer.appendChild(this.continue_button);

    this.intro_status_line = Dom.getElementsByClassName(
      'quiz-intro-status',
      'div'
    )[0];

    page.appendChild(footer);

    return page;
  };

  // }}}
  // {{{ drawQuizPage()

  proto.drawQuizPage = function () {
    var page = document.createElement('div');
    page.className = 'quiz-page quiz-page-quiz';
    page.id = 'quiz_quiz_page';

    this.quiz_status_line = document.createElement('div');
    this.quiz_status_line.className = 'quiz-status';

    var intro_link = document.createElement('a');
    intro_link.className = 'quiz-intro-link';
    intro_link.href = '#intro';
    Event.on(
      intro_link,
      'click',
      function (e) {
        Event.preventDefault(e);
        this.updateIntroPage();
        this.setPageWithAnimation('intro');
        if (typeof amplitude !== 'undefined') {
          amplitude.track('Button_Clicked', {
            button_type: 'CME quiz',
            button_text: 'Return to Introduction'
          });
        }
      },
      this,
      true
    );
    intro_link.appendChild(document.createTextNode(CMEQuizPage.intro_text));

    var header = document.createElement('div');
    header.className = 'quiz-header';
    header.appendChild(intro_link);
    header.appendChild(this.quiz_status_line);

    var clear = document.createElement('div');
    clear.style.clear = 'both';
    header.appendChild(clear);

    this.next_button = document.createElement('input');
    this.next_button.className = 'btn btn-primary quiz-button-next';
    this.next_button.setAttribute('type', 'button');
    this.next_button.value = CMEQuizPage.next_text;
    Event.on(
      this.next_button,
      'click',
      function (e) {
        Event.preventDefault(e);
        this.nextQuestion();
      },
      this,
      true
    );

    this.prev_button = document.createElement('input');
    this.prev_button.className = 'btn btn-default quiz-button-prev';
    this.prev_button.setAttribute('type', 'button');
    this.prev_button.value = CMEQuizPage.previous_text;
    Event.on(
      this.prev_button,
      'click',
      function (e) {
        Event.preventDefault(e);
        this.previousQuestion();
      },
      this,
      true
    );

    var footer = document.getElementById('quiz_footer');
    footer.firstChild.appendChild(this.prev_button);
    footer.firstChild.appendChild(this.next_button);

    clear = document.createElement('div');
    clear.style.clear = 'both';
    footer.firstChild.appendChild(clear);

    var keyboard_help = document.getElementById('quiz_keyboard_help');
    if (is_touch_device) {
      Dom.addClass(keyboard_help, 'quiz-hidden');
    }

    page.appendChild(header);
    page.appendChild(this.el);
    page.appendChild(keyboard_help);
    page.appendChild(footer);

    return page;
  };

  // }}}
  // {{{ drawReviewPage()

  proto.drawReviewPage = function () {
    var page = document.createElement('div');
    page.id = 'quiz_review_page';
    page.className = 'quiz-page quiz-page-review';

    var intro_link = document.createElement('a');
    intro_link.className = 'quiz-intro-link';
    intro_link.href = '#intro';
    Event.on(
      intro_link,
      'click',
      function (e) {
        Event.preventDefault(e);
        this.updateIntroPage();
        this.setPageWithAnimation('intro');
        if (typeof amplitude !== 'undefined') {
          amplitude.track('Button_Clicked', {
            button_type: 'CME quiz',
            button_text: 'Return to Introduction'
          });
        }
      },
      this,
      true
    );
    intro_link.appendChild(document.createTextNode(CMEQuizPage.intro_text));

    var header = document.createElement('div');
    header.className = 'quiz-review-header';
    header.appendChild(intro_link);

    var content = document.createElement('ol');
    content.className = 'quiz-review-content';

    var li, question_text, question_answer, change_button;
    var that = this;
    for (var i = 0; i < this.question_els.length; i++) {
      li = document.createElement('li');

      question_text = document.createElement('div');
      question_text.className = 'quiz-review-question';
      question_text.innerHTML = this.question_els[i].firstChild.innerHTML;

      question_answer = document.createElement('div');
      question_answer.className = 'quiz-review-answer';
      this.question_review_answers.push(question_answer);

      change_button = document.createElement('button');
      change_button.setAttribute('type', 'button');
      change_button.className = 'btn btn-default btn-xs quiz-review-change';
      change_button.appendChild(
        document.createTextNode(CMEQuizPage.change_text)
      );

      (function () {
        var index = i;
        Event.on(
          change_button,
          'click',
          function (e) {
            this.dialog.config.toggle_element = Event.getTarget(e);
            this.openDialog(index);
          },
          that,
          true
        );
      })();

      li.appendChild(change_button);
      li.appendChild(question_text);
      li.appendChild(question_answer);

      content.appendChild(li);
    }

    this.review_status = document.createElement('div');
    this.review_status.className = 'quiz-review-status';

    this.submit_button = document.getElementById('submit_button');
    Dom.addClass(this.submit_button, 'btn');
    Dom.addClass(this.submit_button, 'btn-primary');
    Dom.addClass(this.submit_button, 'quiz-button-submit');
    this.submit_button.value = CMEQuizPage.submit_text;
    Event.on(
      this.submit_button,
      'click',
      function (e) {
        Event.preventDefault(e);
        if (typeof amplitude !== 'undefined') {
          amplitude.track('CME_Quiz_Submitted', {
            episode_id: CMEQuizPage.episode_id
          });
        }
        this.submit();
      },
      this,
      true
    );

    var footer = document.createElement('div');
    footer.className = 'quiz-review-footer';
    footer.appendChild(this.submit_button);
    footer.appendChild(this.review_status);

    page.appendChild(header);
    page.appendChild(content);
    page.appendChild(footer);

    return page;
  };

  // }}}
  // {{{ drawDialog()

  proto.drawDialog = function () {
    this.dialog = new SiteDialog(null, {
      class_name: 'quiz-question-dialog',
      resize_mode: SiteDialog.RESIZE_CENTER
    });

    this.dialog_title = document.createElement('span');
    this.dialog_title.className = 'quiz-question-dialog-title';
    this.dialog.appendToHeader(this.dialog_title);

    var close = document.createElement('input');
    close.className = 'btn btn-primary quiz-button-dialog-close';
    close.setAttribute('type', 'button');
    close.value = CMEQuizPage.close_text;
    Event.on(close, 'click', this.closeDialog, this, true);
    this.dialog.appendToFooter(close);

    this.dialog_content = document.createElement('div');
    this.dialog_content.className = 'quiz-question-dialog-content';
    this.dialog.appendToBody(this.dialog_content);

    this.dialog_question_shim = document.createElement('div');
  };

  // }}}

  // dialog
  // {{{ openDialog()

  proto.openDialog = function (question_index) {
    if (this.dialog_question !== null) {
      // if it's not the current question, hide it again
      if (this.current_question !== this.dialog_question_index) {
        this.dialog_question.style.display = 'none';
      }

      // if dialog is already open, put current question back in quiz
      this.dialog_question_shim.parentNode.replaceChild(
        this.dialog_question,
        this.dialog_question_shim
      );
    }

    // set dialog title
    while (this.dialog_title.firstChild) {
      this.dialog_title.removeChild(this.dialog_title.firstChild);
    }
    this.dialog_title.appendChild(
      document.createTextNode(
        CMEQuizPage.question_title_text.replace(/%s/, question_index + 1)
      )
    );

    this.dialog_question_index = question_index;

    // put question in dialog
    this.dialog_question = this.question_els[question_index];
    this.dialog_question.parentNode.replaceChild(
      this.dialog_question_shim,
      this.dialog_question
    );

    this.dialog_content.appendChild(this.dialog_question);
    this.dialog_question.style.display = 'block';

    this.dialog.openWithAnimation();

    this.focusQuestion(question_index);
  };

  // }}}
  // {{{ closeDialog()

  proto.closeDialog = function () {
    function reinsertQuestion() {
      if (this.dialog_question !== null) {
        // if it's not the current question, hide it again
        if (this.current_question !== this.dialog_question_index) {
          this.dialog_question.style.display = 'none';
        }

        // put current question back in quiz
        this.dialog_question_shim.parentNode.replaceChild(
          this.dialog_question,
          this.dialog_question_shim
        );
        this.dialog_question = null;
      }

      this.dialog_question_index = null;
    }

    this.updateReviewPage();
    reinsertQuestion.call(this);
    this.dialog.closeWithAnimation();
  };

  // }}}

  // page updates
  // {{{ updateIntroPage()

  proto.updateIntroPage = function () {
    while (this.intro_status_line.firstChild) {
      this.intro_status_line.removeChild(this.intro_status_line.firstChild);
    }

    var last_completed = this.validate(this.question_els.length - 1);
    var current_completed = this.validate(this.current_question);

    var completed = 0;
    for (var i = 0; i < this.question_els.length; i++) {
      if (this.validate(i)) {
        completed++;
      }
    }

    var remaining = this.total_questions - completed;
    var time_estimate, time_estimate_str, intro_status_text;

    if (remaining > 30) {
      time_estimate = Math.round((remaining * 2) / 30) / 2;
      if (time_estimate === 1) {
        time_estimate_str = CMEQuizPage.hours_text_1;
      } else {
        time_estimate_str = CMEQuizPage.hours_text_many.replace(
          /%s/,
          time_estimate
        );
      }
    } else {
      time_estimate = Math.ceil((remaining * 2) / 10) * 10;
      time_estimate_str = CMEQuizPage.minutes_text_many.replace(
        /%s/,
        time_estimate
      );
    }

    if (completed === 0) {
      intro_status_text = CMEQuizPage.intro_status_start_text
        .replace(/%s/, this.total_questions)
        .replace(/%s/, time_estimate_str);
    } else if (completed === this.total_questions) {
      intro_status_text = CMEQuizPage.intro_status_review_text
        .replace(/%s/, completed)
        .replace(/%s/, this.total_questions);
    } else {
      intro_status_text = CMEQuizPage.intro_status_continue_text
        .replace(/%s/, completed)
        .replace(/%s/, this.total_questions)
        .replace(/%s/, time_estimate_str);
    }

    this.intro_status_line.appendChild(
      document.createTextNode(intro_status_text)
    );

    if (
      completed === this.total_questions ||
      (current_completed && last_completed)
    ) {
      this.continue_button.value = CMEQuizPage.review_text;
    }
  };

  // }}}
  // {{{ updateQuizPage()

  proto.updateQuizPage = function (question_index) {
    while (this.quiz_status_line.firstChild) {
      this.quiz_status_line.removeChild(this.quiz_status_line.firstChild);
    }

    var quiz_status_text = CMEQuizPage.quiz_status_text
      .replace(/%s/, question_index + 1)
      .replace(/%s/, this.total_questions);

    this.quiz_status_line.appendChild(
      document.createTextNode(quiz_status_text)
    );
  };

  // }}}
  // {{{ updateReviewPage()

  proto.updateReviewPage = function () {
    var unanswered = [];
    var answer, answered, change_button;
    for (var i = 0; i < this.question_els.length; i++) {
      answered = false;
      answer = this.question_review_answers[i];
      change_button = answer.previousSibling.previousSibling;
      for (var j = 0; j < this.question_options[i].length; j++) {
        if (this.question_options[i][j].checked) {
          answer.innerHTML = this.question_labels[i][j].innerHTML;
          answered = true;
          break;
        }
      }

      while (change_button.firstChild) {
        change_button.removeChild(change_button.firstChild);
      }

      if (answered) {
        Dom.addClass(answer.parentNode, 'answered');
        Dom.removeClass(answer.parentNode, 'unanswered');
        Dom.removeClass(change_button, 'btn-primary');
        Dom.addClass(change_button, 'btn-default');
        change_button.appendChild(
          document.createTextNode(CMEQuizPage.change_text)
        );
      } else {
        unanswered.push(i);
        Dom.removeClass(answer.parentNode, 'answered');
        Dom.addClass(answer.parentNode, 'unanswered');
        Dom.removeClass(change_button, 'btn-default');
        Dom.addClass(change_button, 'btn-primary');
        change_button.appendChild(
          document.createTextNode(CMEQuizPage.answer_text)
        );
      }
    }

    Event.purgeElement(this.review_status, true, 'click');
    while (this.review_status.firstChild) {
      this.review_status.removeChild(this.review_status.firstChild);
    }

    var anchor;
    if (unanswered.length === 0) {
      this.review_status.appendChild(
        document.createTextNode(CMEQuizPage.review_status_text_0)
      );

      this.submit_button.disabled = false;
      Dom.removeClass(this.submit_button, 'swat-insensitive');
    } else {
      Dom.addClass(this.submit_button, 'swat-insensitive');
      this.submit_button.disabled = true;

      if (unanswered.length === 1) {
        var parts = CMEQuizPage.review_status_text_1.split(/%s/, 2);
        this.review_status.appendChild(document.createTextNode(parts[0]));

        anchor = document.createElement('a');
        anchor.href = '#question' + (unanswered[0] + 1);
        anchor.appendChild(
          document.createTextNode(
            CMEQuizPage.question_title_text.replace(/%s/, unanswered[0] + 1)
          )
        );
        Event.on(
          anchor,
          'click',
          function (e) {
            Event.preventDefault(e);
            this.dialog.config.toggle_element = Event.getTarget(e);
            this.openDialog(unanswered[0]);
          },
          this,
          true
        );
        this.review_status.appendChild(anchor);

        if (parts.length > 1) {
          this.review_status.appendChild(document.createTextNode(parts[1]));
        }
      } else if (unanswered.length < 6) {
        var parts = CMEQuizPage.review_status_text_2_to_5.split(/%s/, 2);
        this.review_status.appendChild(document.createTextNode(parts[0]));

        var that = this;
        for (var i = 0; i < unanswered.length; i++) {
          anchor = document.createElement('a');
          anchor.href = '#question' + (unanswered[i] + 1);
          anchor.appendChild(
            document.createTextNode(
              CMEQuizPage.question_title_text.replace(/%s/, unanswered[i] + 1)
            )
          );
          (function () {
            var index = unanswered[i];
            Event.on(
              anchor,
              'click',
              function (e) {
                Event.preventDefault(e);
                that.dialog.config.toggle_element = Event.getTarget(e);
                that.openDialog(index);
              },
              that,
              true
            );
          })();
          this.review_status.appendChild(anchor);

          if (i === unanswered.length - 2) {
            this.review_status.appendChild(document.createTextNode(' and '));
          } else if (i < unanswered.length - 1) {
            this.review_status.appendChild(document.createTextNode(', '));
          }
        }

        if (parts.length > 1) {
          this.review_status.appendChild(document.createTextNode(parts[1]));
        }
      } else {
        this.review_status.appendChild(
          document.createTextNode(
            CMEQuizPage.review_status_text_many.replace(/%s/, unanswered.length)
          )
        );
      }

      this.review_status.appendChild(
        document.createTextNode(' ' + CMEQuizPage.review_status_required_text)
      );
    }
  };

  // }}}

  // pages
  // {{{ setPage()

  proto.setPage = function (page_id, force) {
    if (!force && this.current_page === page_id) {
      return;
    }

    this.pages[this.current_page].style.display = 'none';
    this.pages[page_id].style.display = 'block';

    this.current_page = page_id;
  };

  // }}}
  // {{{ setPageWithAnimation()

  proto.setPageWithAnimation = function (page_id) {
    if (this.current_page === page_id) {
      return;
    }

    this.fadeOutPage(this.current_page, page_id);

    this.current_page = page_id;
  };

  // }}}
  // {{{ fadeOutPage()

  proto.fadeOutPage = function (old_page, new_page) {
    var anim = new Anim(
      this.page_container,
      { opacity: { to: 0 } },
      CMEQuizPage.fade_period
    );

    anim.onComplete.subscribe(
      function () {
        this.resizePage(old_page, new_page);
      },
      this,
      true
    );

    anim.animate();
  };

  // }}}
  // {{{ resizePage()

  proto.resizePage = function (old_page, new_page) {
    var old_el = this.pages[old_page];
    var new_el = this.pages[new_page];

    var old_region = Dom.getRegion(old_el);
    var old_height = old_region.bottom - old_region.top;

    this.page_container.style.height = old_height + 'px';
    this.page_container.style.overflow = 'hidden';
    Dom.setStyle(this.page_container, 'opacity', 0);

    new_el.style.display = 'block';
    old_el.style.display = 'none';
    var new_region = Dom.getRegion(new_el);
    var new_height = new_region.bottom - new_region.top;

    var anim = new Anim(
      this.page_container,
      { height: { from: old_height, to: new_height } },
      CMEQuizPage.resize_period
    );

    anim.onComplete.subscribe(
      function () {
        this.fadeInPage(old_page, new_page);
        this.page_container.style.height = 'auto';
        this.page_container.style.overflow = 'visible';
      },
      this,
      true
    );

    anim.animate();
  };

  // }}}
  // {{{ fadeInPage()

  proto.fadeInPage = function (old_page, new_page) {
    var anim = new Anim(
      this.page_container,
      { opacity: { to: 1 } },
      CMEQuizPage.fade_period
    );

    anim.animate();
  };

  // }}}

  // questions
  // {{{ setQuestion()

  proto.setQuestion = function (question_index, force) {
    if (!force && this.current_question === question_index) {
      return;
    }

    this.question_els[this.current_question].style.display = 'none';

    this.question_els[question_index].style.display = 'block';
    this.updateQuizPage(question_index);

    this.current_question = question_index;

    if (this.current_question === this.total_questions - 1) {
      this.next_button.value = CMEQuizPage.review_text;
    } else {
      this.next_button.value = CMEQuizPage.next_text;
    }

    if (this.current_question === 0) {
      Dom.addClass(this.prev_button, 'swat-insensitive');
      this.prev_button.disabled = true;
    } else {
      this.prev_button.disabled = false;
      Dom.removeClass(this.prev_button, 'swat-insensitive');
    }
  };

  // }}}
  // {{{ setQuestionWithAnimation()

  proto.setQuestionWithAnimation = function (question_index, direction) {
    if (this.current_question === question_index) {
      return;
    }

    this.fadeOutQuestion(this.current_question, question_index, direction);
    this.updateQuizPage(question_index);

    this.current_question = question_index;

    if (this.current_question === this.total_questions - 1) {
      this.next_button.value = CMEQuizPage.review_text;
    } else {
      this.next_button.value = CMEQuizPage.next_text;
    }

    if (this.current_question === 0) {
      Dom.addClass(this.prev_button, 'swat-insensitive');
      this.prev_button.disabled = true;
    } else {
      this.prev_button.disabled = false;
      Dom.removeClass(this.prev_button, 'swat-insensitive');
    }
  };

  // }}}
  // {{{ fadeOutQuestion()

  proto.fadeOutQuestion = function (old_question, new_question, direction) {
    var anim = new Anim(
      this.question_container,
      { opacity: { to: 0 } },
      CMEQuizPage.fade_period
    );

    anim.onComplete.subscribe(
      function () {
        this.resizeQuestion(old_question, new_question, direction);
      },
      this,
      true
    );

    anim.animate();

    var attribs;
    if (direction === 'right') {
      this.question_els[old_question].style.left = 'auto';
      attribs = { right: { to: 100 } };
    } else {
      this.question_els[old_question].style.right = 'auto';
      attribs = { left: { to: 100 } };
    }

    var question_anim = new Anim(
      this.question_els[old_question],
      attribs,
      CMEQuizPage.fade_period,
      Easing.easeIn
    );

    question_anim.animate();
  };

  // }}}
  // {{{ resizeQuestion()

  proto.resizeQuestion = function (old_question, new_question, direction) {
    var old_el = this.question_els[old_question];
    var new_el = this.question_els[new_question];

    Dom.setStyle(this.question_container, 'opacity', 0);

    if (direction === 'right') {
      Dom.setStyle(new_el, 'left', 'auto');
      Dom.setStyle(new_el, 'right', '-100px');
    } else {
      Dom.setStyle(new_el, 'right', 'auto');
      Dom.setStyle(new_el, 'left', '-100px');
    }

    new_el.style.display = 'block';
    old_el.style.display = 'none';

    this.fadeInQuestion(old_question, new_question, direction);
  };

  // }}}
  // {{{ fadeInQuestion()

  proto.fadeInQuestion = function (old_question, new_question, direction) {
    var anim = new Anim(
      this.question_container,
      { opacity: { to: 1 } },
      CMEQuizPage.fade_period
    );

    this.focusQuestion(new_question);

    anim.onComplete.subscribe(function () {}, this, true);

    anim.animate();

    var attribs;
    if (direction === 'right') {
      attribs = { right: { to: 0 } };
    } else {
      attribs = { left: { to: 0 } };
    }

    var question_anim = new Anim(
      this.question_els[new_question],
      attribs,
      CMEQuizPage.fade_period,
      Easing.easeOut
    );

    question_anim.animate();
  };

  // }}}
  // {{{ nextQuestion()

  proto.nextQuestion = function () {
    if (typeof amplitude !== 'undefined') {
      amplitude.track('Button_Clicked', {
        button_type: 'CME quiz',
        button_text: 'Next Question'
      });
    }

    if (this.current_question === this.total_questions - 1) {
      this.updateReviewPage();
      this.setPageWithAnimation('review');
    } else {
      this.setQuestionWithAnimation(this.current_question + 1, 'right');
    }
  };

  // }}}
  // {{{ previousQuestion()

  proto.previousQuestion = function () {
    if (this.current_question === 0) {
      return;
    }

    if (typeof amplitude !== 'undefined') {
      amplitude.track('Button_Clicked', {
        button_type: 'CME quiz',
        button_text: 'Previous Question'
      });
    }

    var form_field = this.question_fields[this.current_question];

    Dom.removeClass(form_field, 'swat-form-field-with-messages');

    this.setQuestionWithAnimation(this.current_question - 1, 'left');
  };

  // }}}
  // {{{ focusQuestion()

  proto.focusQuestion = function (question_index) {
    var index = 0;

    for (var i = 0; i < this.question_options[question_index].length; i++) {
      if (this.question_options[question_index][i].checked) {
        index = i;
        break;
      }
    }

    this.question_options[question_index][index].focus();
  };

  // }}}
  // {{{ selectOption()

  proto.selectOption = function (option_index) {
    // don't choose option if not on the quiz or dialog
    if (this.current_page !== 'quiz' && this.dialog_question_index === null) {
      return;
    }

    var question_index =
      this.dialog_question_index !== null
        ? this.dialog_question_index
        : this.current_question;

    if (this.question_labels[question_index][option_index]) {
      this.question_labels[question_index][option_index].click();
      this.focusQuestion(question_index);
    }
  };

  // }}}
  // {{{ validate()

  proto.validate = function (question_index) {
    var valid = false;

    var options = this.question_options[question_index];
    if (!options) {
      return;
    }

    for (var i = 0; i < options.length; i++) {
      if (options[i].checked) {
        valid = true;
        break;
      }
    }

    return valid;
  };

  // }}}

  // saving
  // {{{ saveResponseValue()

  proto.saveResponseValue = function (el, question_index) {
    var n, message, li;
    for (var i = 0; i < this.question_options[question_index].length; i++) {
      n = this.question_options[question_index][i];
      li = Dom.getAncestorByTagName(n, 'li');
      message = this.question_option_messages[n.id];
      if (n === el) {
        message.style.display = 'block';
        Dom.setStyle(message, 'opacity', 1);
        Dom.addClass(li, 'selected');
      } else {
        message.style.display = 'none';
        Dom.removeClass(li, 'selected');
      }
    }
    message = this.question_option_messages[el.id];

    var callback = {
      success: function (o) {
        var anim = new Anim(
          message,
          { opacity: { to: 0 } },
          CMEQuizPage.saving_fade_period
        );

        anim.onComplete.subscribe(
          function () {
            message.style.display = 'none';

            // reset filter for IE to prevent rendering bugs.
            message.style.filter = '';
          },
          this,
          true
        );

        anim.animate();

        var response;
        try {
          response = JSON.parse(o.responseText);
        } catch (e) {
          response = { status: { code: 'error', message: '' } };
        }

        if (response.code === 'error') {
        }
      },
      failure: function (o) {},
      argument: [],
      scope: this
    };

    var list = Dom.getFirstChild(
      Dom.getFirstChild(
        Dom.getNextSibling(Dom.getFirstChild(this.question_els[question_index]))
      )
    );

    var binding_id = parseInt(list.id.replace(/question/, ''), 10);
    var option_id = parseInt(el.id.split('_', 3)[2], 10);
    var timestamp = parseInt(Math.round(new Date().getTime() / 1000), 10);

    var post_data =
      'binding_id=' +
      binding_id +
      '&option_id=' +
      option_id +
      '&timestamp=' +
      timestamp;

    Connect.asyncRequest('POST', this.response_server, callback, post_data);
  };

  proto.submit = function () {
    if (this.is_submitted) {
      return;
    }

    this.is_submitted = true;

    var form = Dom.getAncestorByTagName(this.next_button, 'form');

    Dom.addClass('swat-insensitive', this.submit_button);
    this.submit_button.disabled = true;

    form.submit();
  };

  // }}}
})();
