let StartPage = React.createClass({
  loginJudge: function () {
    let becomeJudge = this.props.becomeJudge;
    $('#judgeLogin').show();
    $('#submitJudgeLogin').on('click', function(){
      if ($('#judgeName').val() == 'judge' && $('#judgePass').val() == 'P4ssword') {
        becomeJudge();
        alert("success!")
      }
      $('#judgeLogin').hide();
    });
  },
  setUpGame: function () {
    let game_length = $('input[name=length]:checked').val();
    this.props.startPlay(game_length);
  },
  render: function () {
    if (this.props.gameLength != 0 && (this.props.currentQuestion) == this.props.gameLength) {
      alert("game over!"); // TODO go back to homepage?
    }
    let self = this;
    socket.on('update game', function (data) {
      self.props.updateState(Object.assign({}, data, {judge: self.props.judge}));
    });
    let play = this.props.beginGame;
    let content = play ? <Game /> : <div><p>Welcome!</p><p>What length of game do you want to play?</p><input type="radio" name="length" value='4'> Short </input><br/>
  <input type="radio" name='5' value="medium"> Medium </input><br/>
  <input type="radio" name='6' value="long"> Long </input><br/><br/><button onClick={this.loginJudge}> Judge Login </button><button onClick={this.setUpGame}> Play! </button></div>;
    return (
      <div>
        {content}
        <div id="judgeLogin">
          <h2>Login</h2>
          <input id="judgeName" name="user_name" placeholder="User Name" type="text"/>
          <input id="judgePass" name="password" type="password"/>
          <button id="submitJudgeLogin"> Submit </button>
        </div>
      </div>
    )
  }
});

let Game = React.createClass({
  loadQuestionsFromJson: function () {
    $.ajax({
      url: this.props.url,
      dataType: 'json',
      cache: false,
      success: function (data) {
        this.shuffleQuestions (data);
      }.bind(this),
      error: function (xhr, status, err) {
        console.error(this.props.url, status, err.toString());
      }.bind(this)
    });
  },
  componentDidMount: function () {
    this.loadQuestionsFromJson();
  },
  shuffleQuestions: function (data) {
    //randomize the keys to the questions (originally they are in alphabetical order)
    //TODO, prioritize lower counter numbers

    let key_array = Object.keys(data);
    let shuffled = key_array.slice(0), i = key_array.length, temp, index;
    while (i--) {
        index = Math.floor((i + 1) * Math.random());
        temp = shuffled[index];
        shuffled[index] = shuffled[i];
        shuffled[i] = temp;
    }
    this.props.setQuestions(data, shuffled);
  },
  triggerStrike: function () {
    this.props.incrementStrikeCount(this.props.strikeCount + 1);
  },
  nextQuestion: function () {
    this.props.advanceQuestion();
  },
  render: function () {
    return(
      <div>
        {this.props.data.nameSomethingThatFirefoxDoes &&
          <header><h1>{this.props.keys[this.props.currentQuestion].replace(/([A-Z])/g, ' $1').replace(/^./, function (str){ return str.toUpperCase(); })}</h1></header>
        }
        <AnswerSection />
        <section className="strikes">
        	<div className="one-strike">☒</div>
        	<div className="two-strikes">☒☒</div>
        	<div className="three-strikes">☒☒☒</div>
        </section>
        { this.props.judge &&
          <div>
            <button onClick={this.triggerStrike}> Wrong! </button>
            <button onClick={this.nextQuestion}> Next Question </button>
          </div>
        }
      </div>
    );
  }
});

let AnswerContainer = React.createClass({
  emitRevealAnswer: function(e) {
    if (this.props.judge) {
      this.props.addRevealedAnswer(this.props.index);
    }
  },
  render: function () {
    let reveal = '';
    let clicked = false;
    let index = this.props.index;
    this.props.revealedAnswers.forEach(function (revealed) {
      if (revealed === index) {
        clicked = true;
      }
    });
    if (this.props.judge && clicked) {
      reveal = ' reveal clicked';
    } else if (this.props.judge || clicked) {
      reveal = ' reveal';
    }

    return(
      <div className={'flip-container' + reveal} onClick={this.emitRevealAnswer}>
        <div className='flipper'>
          <div className='front face'>{index}</div>
          <div className='back face'>
            <span className='answer'>{this.props.answer}</span>
            <span className='points'>{this.props.count}</span>
          </div>
        </div>
      </div>
    );
  }
});

let AnswerSection = React.createClass({
  calculateContainers: function () {
    let containers = [];

    if (this.props.keys.length) {
      $.each(this.props.data[this.props.keys[this.props.currentQuestion]].answers, function (i, value) {
        let answer = value[0];
        let count = value[1];
        containers.push(<AnswerContainer key={i} index={i+1} answer={answer} count={count}/>);
      });
    }

    return containers;
  },
  render: function () {
    return(
      <section className='answers'>
        {this.calculateContainers()}
      </section>
    );
  }

});

//createStore, provider, and set initial State
let createStore = Redux.createStore;
let Provider = ReactRedux.Provider;
let connect = ReactRedux.connect;

let initialState = {
  gameLength: 0,
  currentQuestion: 0,
  strikeCount: 0,
  judge: false,
  beginGame: false,
  keys: [],
  data: [],
  url: '/api/feud-data',
  revealedAnswers: []
}

let reducer = function (state, action) {
  if (state === undefined) {
    return initialState;
  }
  let newState = state;

  switch (action.type) {
    case 'set_questions':
      newState = Object.assign({}, state, {data: action.data, keys: action.keys});
      socket.emit('update game', newState);
      break;
    case 'advance_question':
      let nextQuestion = state.currentQuestion + 1;
      newState = Object.assign({}, state, {strikeCount: 0, currentQuestion: nextQuestion, revealedAnswers: []});
      socket.emit('update game', newState);
      break;
    case 'start_play':
      newState = Object.assign({}, state, {beginGame: true, gameLength: action.game_length});
      break;
    case 'become_judge':
      newState = Object.assign({}, state, {judge: true});
      break;
    case 'update_state':
      newState = Object.assign({}, state, action.new_state);
      break;
    case 'increment_strike':
      newState = Object.assign({}, state, {strikeCount: action.strikeCount});
      socket.emit('trigger strike', action.strikeCount);
      break;
    case 'reveal_answer':
      newState = Object.assign({}, state, {});
      newState.revealedAnswers = [...state.revealedAnswers, action.answer];
      socket.emit('update game', newState);
      break;
  }
  return newState;
}

let store = createStore(reducer, initialState);

//Pass initial state to game as props
let GameState = function (state) {
  return {
    gameLength: state.gameLength,
    strikeCount: state.strikeCount,
    judge: state.judge,
    beginGame: state.beginGame,
    keys: state.keys,
    currentQuestion: state.currentQuestion,
    url: state.url,
    data: state.data,
    revealedAnswers: state.revealedAnswers
  }
}

let GameDispatch = function (dispatch) {
  return {
    setQuestions: function (data, keys) {
      dispatch({
        type: 'set_questions',
        data: data,
        keys: keys
      });
    },
    advanceQuestion: function () {
      dispatch({
        type: 'advance_question'
      });
    },
    startPlay: function (game_length) {
      dispatch({
        type: 'start_play',
        game_length
      });
    },
    becomeJudge: function () {
      dispatch({
        type: 'become_judge'
      });
    },
    updateState: function (new_state) {
      dispatch({
        type: 'update_state',
        new_state: new_state
      });
    },
    incrementStrikeCount: function (count) {
      dispatch({
        type: 'increment_strike',
        strikeCount: count
      });
    },
    addRevealedAnswer: function (answer) {
      dispatch({
        type: 'reveal_answer',
        answer: answer
      });
    }
  }
}

StartPage = connect(
  GameState,
  GameDispatch
)(StartPage)
Game = connect(
  GameState,
  GameDispatch
)(Game)
AnswerContainer = connect(
  GameState,
  GameDispatch
)(AnswerContainer)
AnswerSection = connect(
  GameState,
  GameDispatch
)(AnswerSection)



ReactDOM.render(
  <Provider store={store}>
      <StartPage/>
  </Provider>,
  document.getElementById('content')
);
