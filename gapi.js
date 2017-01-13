/**
 * Initial setup
 */
var CLIENT_ID = '';
var GOOGLE_API_KEY = '';
var SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/gmail.readonly'];
var GOOGLE = GOOGLE || {};

GOOGLE.isAuthorized = null;


/**
 * Function that initializes Google Calendar API
 * and allow all other gapi.client.calendar.* calls
 */
function gapiLoaded() {
  gapi.auth.authorize(
    {
      'client_id': CLIENT_ID,
      'scope': SCOPES.join(' '),
      'immediate': true
    }, function(authResult) {
      if (authResult && !authResult.error) {
        GOOGLE.isAuthorized = true;
      } else {
        GOOGLE.isAuthorized = false;
      }
  });
}

/**
 * Main function of the library.
 * Checks if gapi is loaded and checks the auth satus.
 * Also loads calendar v3 library and does promised requests.
 */
GOOGLE.do = function(subapi, fn, args) {
  var q = new Promise(function(resolve, reject) {
    gapi.client.load('calendar', 'v3', function() {
      var request = gapi.client.calendar[subapi][fn].call(null, args);
      request.execute(function(resp) {
        if (!resp.errors) {
          resolve(resp);
        } else {
          reject(resp.errors);
        }
      });
    });
  });
  return q;
}

/**
 * Main function for fetching Gmail API
 * Checks if gapi is loaded and checks the auth satus.
 * Also loads Gmail vą library and does promised requests.
 */
GOOGLE.gmail = function(subapi, fn, args) {
  var q = new Promise(function(resolve, reject) {
    gapi.client.load('gmail', 'v1', function() {
      var request = gapi.client.gmail.users[subapi][fn].call(null, args);
      request.execute(function(resp) {
        if (!resp.errors) {
          resolve(resp);
        } else {
          reject(resp.errors);
        }
      });
    });
  });
  return q;
}

/**
 * Get email list
 */
GOOGLE.getMails = function() {
  return this.gmail('messages', 'list', {userId: 'me'});
}

/**
 * Get one message as an object.
 */
GOOGLE.getMail = function(id) {
  var q = new Promise(function(resolve, reject) {
    GOOGLE.gmail('messages', 'get', {userId: 'me', id}).then(function(message) {
      function findProperty(prop) {
        return message.payload.headers.filter(function(val) {
          return val.name === prop
        })[0].value;
      }
      var formattedMessage = {
        body: message.snippet,
        from: findProperty('From'),
        date: findProperty('Date'),
      }
      resolve(formattedMessage);
    })
    .catch(function(err) {
      reject(err);
    });
  });
  return q;
}

/**
 * Initiate auth flow.
 *
 * Returns a promise which is resolved if user is signed in
 * and rejected if user does not finish the auth flow.
 */
GOOGLE.authorize = function(silent) {
  if (!gapi) {
    return "GAPI Library isn't loaded!";
  }
  var q = new Promise(function(resolve, reject) {
    try {
      gapi.client.setApiKey(GOOGLE_API_KEY);
      gapi.auth.authorize(
      {client_id: CLIENT_ID, scope: SCOPES, immediate: silent === true},
      function(authResult) {
        if (authResult && !authResult.error) {
          GOOGLE.isAuthorized = true;
          resolve();
        } else {
          GOOGLE.isAuthorized = false;
          reject(authResult.error);
        }
      });
    }
    catch(err) {
      reject('gapi' + err);
    }
  });
  return q;
}

/**
 * Get event list of the primary calendar
 */
GOOGLE.listEvents = function(params) {
  // TODO: Implement pagination
  var params =
  {
    'calendarId': 'primary',
    'timeMin': params['start_datetime'],
    'showDeleted': false,
    'singleEvents': true,
    'orderBy': 'startTime',
    'maxResults': 2500
  };

  return this.do('events', 'list', params);
}

/**
 * Perform initial import of events from Google service
 *
 **
 * @Params
 *
 * end: object
 *   dateTime: String
 *
 * start: object
 *   dateTime: String
 *
 * iCalUID
 **/
GOOGLE.importEvents = function(params) {
  var end_date = params['end_datetime'] || (new Date()).toISOString();
  var start_date = params['start_datetime'] || (new Date()).toISOString();
  var params =
  {
    calendarId: 'primary',
    iCalUID: 'primary',
    start: {
      dateTime: start_date
    },
    end: {
      dateTime: end_date
    }
  };

  return this.do('events', 'import', params);
}


/**
 * Print all of the available calendars of user
 **
 * @Params
 **
 * Optional
 **
 * maxResults: Integer
 * minAccessRole: String
 * pageToken: String
 * showDeleted: Boolean
 * showHidden: Boolean
 * syncToken: String
 **/
GOOGLE.listCalendars = function() {
  return this.do('calendarList', 'list', {});
};

/**
 * Inserts an event into a primary calendar of a user
 **
 * @Params
 **
 * Required
 **
 * summary: String
 * end: Object
 *   dateTime: String
 *   timeZone: String, optional
 * start: Object
 *   dateTime: String
 *   timeZone: String, optional
 **
 * Optional
 **
 * description: String
 * recurrence: String, ex: 'RRULE:FREQ=DAILY;COUNT=2'
 * reminders: Object
 *   useDefault: boolean
 *   overrides: Array of objects
 *     override: Object, ex: {'method': 'email|popup', 'minutes': 24 * 60}
 * attendees: Array
 *   atendee: Object, ex: {'email': 'danielius@wisemonks.com'}
 * location: String
 */
GOOGLE.createEvent = function(event) {


  var googleEvent = {
    summary: event.title,
    location: event.location,
    start: {
      dateTime: event.start_datetime,
      timeZone:  'Europe/Vilnius'
    },
    end: {
      dateTime: event.end_datetime,
      timeZone:  'Europe/Vilnius'
    },
    colorId: event.colorId
  }
  if(event.attendees){
    if (event.attendees.length > 0) {
      googleEvent['attendees'] = event.attendees;
    }
  }
  if(event.reminders){
    if (event.reminders.overrides.length > 0) {
      googleEvent['reminders'] = event.reminders;
    }
  }
  if(event.recurrence){
    if (event.recurrence.length > 0) {
      googleEvent['recurrence'] = event.recurrence;
    }
  }

  var params =
  {
    calendarId: 'primary',
    resource: googleEvent
  }

  return this.do('events', 'insert', params);
};


GOOGLE.updateEvent = function(event) {

  var googleEvent = {
    summary: event.title,
    location: event.location,
    start: {
      dateTime: event.start_datetime,
      timeZone:  'Europe/Vilnius'
    },
    end: {
      dateTime: event.end_datetime,
      timeZone:  'Europe/Vilnius'
    },
    colorId: event.colorId
  }
  if(event.attendees){
    if (event.attendees.length > 0) {
      googleEvent['attendees'] = event.attendees;
    }
  }
  if(event.reminders){
    if (event.reminders.overrides.length > 0) {
      googleEvent['reminders'] = event.reminders;
    }
  }
  if(event.recurrence){
    if (event.recurrence.length > 0) {
      googleEvent['recurrence'] = event.recurrence;
    }
  }

  var params =
  {
    calendarId: 'primary',
    eventId: event.event_id,
    resource: googleEvent
  }
  return this.do('events', 'update', params);
};


GOOGLE.getEvent = function(event_id) {

  var params =
  {
    calendarId: 'primary',
    eventId: event_id
  }

  return this.do('events', 'get', params);
};

GOOGLE.deleteEvent = function(event_id) {

  var params =
  {
    calendarId: 'primary',
    eventId: event_id
  }

  return this.do('events', 'delete', params);
};
