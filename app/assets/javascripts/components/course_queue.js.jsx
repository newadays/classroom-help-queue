var CourseQueue = React.createClass({
  getInitialState: function () {
    return {
      enabled: false,
      instructorMode: this.props.instructor,
      requests: [],
      instructors: [],
    };
  },
  enable: function () {
    this.setState({ enabled: true });
  },
  amIOnline: function () {
    return mapById(this.state.instructors, this.props.currentUserId) >= 0;
  },
  disable: function () {
    this.setState({ enabled: false });
  },
  pushRequest: function (request) {
    this.setState({
      requests: this.state.requests.concat([request])
    });
  },
  removeRequest: function (request) {
    var index = mapById(this.state.requests, request.id);

    // splice returns the elements removed from the array, we want the opposite.
    // to make sure the state stays clean, copy the array, remove the element,
    // then update the state.
    var arrCopy = this.state.requests.slice();
    arrCopy.splice(index, 1);

    this.setState({
      requests: arrCopy,
    });
  },
  pushInstructor: function (instructor) {
    this.setState({
      instructors: this.state.instructors.concat([instructor])
    });
  },
  removeInstructor: function (instructor) {
    var index = mapById(this.state.instructors, instructor.id);

    // splice returns the elements removed from the array, we want the opposite.
    // to make sure the state stays clean, copy the array, remove the element,
    // then update the state.
    var arrCopy = this.state.instructors.slice();
    arrCopy.splice(index, 1);

    this.setState({
      instructors: arrCopy,
    });
  },
  fetchOutstandingRequests: function () {
    return $.ajax({
      url: '/course_queues/' + this.props.id + '/outstanding_requests.json'
    });
  },
  fetchOnlineInstructors: function () {
    return $.ajax({
      url: '/course_queues/' + this.props.id + '/online_instructors.json'
    });
  },
  componentWillMount: function () {
    var courseQueueSubscription = App.cable.subscriptions.create({
      channel: 'QueueChannel',
      id: this.props.id
    }, {
      connected: function () {
        $.when(this.fetchOutstandingRequests(), this.fetchOnlineInstructors())
          .done(function (requests, instructors) {
            this.setState({
              instructors: instructors[0],
              requests: requests[0],
            }, this.enable);
          }.bind(this));
      }.bind(this),
      disconnected: function () {
        this.disable();
      }.bind(this),
      received: function (data) {
        if (data.action === 'new_request') {
          this.pushRequest(data.request);
        } else if (data.action === 'resolve_request') {
          this.removeRequest(data.request);
        } else if (data.action === 'instructor_offline') {
          this.removeInstructor(data.instructor);
        } else if (data.action === 'instructor_online') {
          this.pushInstructor(data.instructor);
        }
      }.bind(this),
    });

    this.handler = new CourseQueueClientActionHandler(courseQueueSubscription);
  },
  setMode: function (mode) {
    if (!this.props.instructor) return;

    this.setState({
      instructorMode: mode,
    });
  },
  getMyFirstRequest: function () {
    var index = this.state.requests.map(function (elt) {
      return elt.requester_id;
    }).indexOf(this.props.currentUserId);

    if (index >= 0) {
      return {
        request: this.state.requests[index],
        resolver: this.handler.resolveRequest.bind(this.handler, this.state.requests[index].id),
      }
    }

    return null;
  },
  renderLeftPanel: function (segmentClass, columnClass) {
    var panel, instructorButton, studentButton, buttons;

    if (this.props.instructor && this.state.instructorMode) {
      instructorButton = 'active';
      panel = (
        <InstructorPanel
          segmentClass={segmentClass}
          requests={this.state.requests}
          instructors={this.state.instructors}
          online={this.amIOnline()}
          currentUserId={this.props.currentUserId}
          queuePop={this.handler.queuePop.bind(this.handler)}
          setInstructorStatus={this.handler.setInstructorStatus.bind(this.handler)}
          takeQueueOffline={this.handler.takeQueueOffline.bind(this.handler)}
        />
      );
    } else {
      studentButton = 'active';
      panel = (
        <StudentPanel
          segmentClass={segmentClass}
          requestHelp={this.handler.newRequest.bind(this.handler)}
          cancelRequest={this.handler.cancelRequest.bind(this.handler)}
          myRequest={this.getMyFirstRequest()}
          queueClosed={this.state.instructors.length <= 0}
        />
      );
    }

    if (this.props.instructor && this.state.enabled) {
      buttons = (
        <div className="ui two basic buttons">
          <div onClick={this.setMode.bind(this, true)} className={"ui button " + instructorButton}>Instructor Mode</div>
          <div onClick={this.setMode.bind(this, false)} className={"ui button " + studentButton}>Student Mode</div>
        </div>
      );
    }

    return (
      <div className={columnClass}>
        {buttons}
        {panel}
      </div>
    );
  },
  render: function () {
    var segmentClass = this.state.enabled ?
      'ui min segment' : 'ui disabled loading min segment';

    return (
      <div className="ui stackable grid">
        <div className="sixteen wide column">
          <Header
            courseName={this.props.courseName}
            queueName={this.props.queueName}
            queueLoc={this.props.queueLoc}
          />
          <Instructors instructors={this.state.instructors} />
        </div>
        <QueueClosedMessage
          enabled={this.state.enabled}
          instructors={this.state.instructors} />
        {this.renderLeftPanel(segmentClass, "six wide column")}
        <div className="ten wide column">
          <RequestBox
            segmentClass={segmentClass}
            requests={this.state.requests}
            resolve={this.props.instructor ? this.handler.resolveRequest.bind(this.handler) : null}
          />
        </div>
      </div>
    );
  }
});
