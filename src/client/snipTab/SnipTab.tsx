import * as React from "react";
import { Provider, Flex, Text, Button, Header } from "@fluentui/react-northstar";
import { useState, useEffect } from "react";
import { useTeams } from "msteams-react-base-component";
import { app, authentication, FrameContexts } from "@microsoft/teams-js";
import jwtDecode from "jwt-decode";
import { Grid, Box, Form, FormInput, FormButton, Card, Checkbox, Pill } from "@fluentui/react-northstar";
import { Provider as RTProvider, themeNames, List, CommunicationOptions, TListInteraction, TToolbarInteraction } from "@fluentui/react-teams";
import { TeamsTheme } from "@fluentui/react-teams/lib/cjs/themes";
import Axios from "axios";
import { OnlineMeeting } from "@microsoft/microsoft-graph-types-beta";
import { orderBy, sortBy } from "lodash";


interface IStandupPresenter {
  id: string;
  name: string;
}
interface IStandupTopic {
  id: string;
  presenter: IStandupPresenter;
  title: string;
  approved: boolean;
  presented: boolean;
}

/**
 * Implementation of the Snip content page
 */
export const SnipTab = () => {

  const [{ inTeams, theme, themeString, context }] = useTeams();
  const [entityId, setEntityId] = useState<string | undefined>();
  const [name, setName] = useState<string>();
  const [error, setError] = useState<string>();

  const [accessToken, setAccessToken] = useState<string>();
  const [meetingId, setMeetingId] = useState<string | undefined>();
  const [onlineMeeting, setOnlineMeeting] = useState<OnlineMeeting>({});
  const [frameContext, setFrameContext] = useState<FrameContexts | null>();
  const [showAddTopicForm, setShowAddTopicForm] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [standupTopics, setStandupTopics] = useState<IStandupTopic[]>([]);
  const [newTopicTitle, setNewTopicTitle] = useState<string>();

  const [currentUserIsOrganizer, setCurrentUserIsOrganizer] = useState<boolean>(false);


  useEffect(() => {
    if (onlineMeeting && currentUserId && onlineMeeting?.participants?.organizer?.identity?.user?.id === currentUserId) {
      setCurrentUserIsOrganizer(true);
    } else {
      setCurrentUserIsOrganizer(false);
    }
  }, [currentUserId, onlineMeeting]);

  useEffect(() => {

    if (inTeams === true) {
      authentication.getAuthToken({
        resources: [process.env.TAB_APP_URI as string],
        silent: false
      } as authentication.AuthTokenRequestParameters).then(token => {
        const decoded: { [key: string]: any; } = jwtDecode(token) as { [key: string]: any; };
        setCurrentUserId(decoded.oid);
        setCurrentUserName(decoded!.name);
        setAccessToken(token);
        app.notifySuccess();
      }).catch(message => {
        setError(message);
        app.notifyFailure({
          reason: app.FailedReason.AuthFailed,
          message
        });
      });
    } else {
      setEntityId("Not in Microsoft Teams");
    }
  }, [inTeams]);

  useEffect(() => {
    if (context) {
      setEntityId(context.page.id);
      // set the meeting context
      setMeetingId(context.meeting?.id);
      setFrameContext(app.getFrameContext());
    }
  }, [context]);

  useEffect(() => {
    (async () => {
      if (meetingId && accessToken) {
        const authHeader: any = {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        };

        // get meeting details
        const meetingDetailsResponse = await Axios.get<OnlineMeeting>(`https://${process.env.PUBLIC_HOSTNAME}/api/standupagenda/meetingDetails/${meetingId}`, authHeader);
        setOnlineMeeting(meetingDetailsResponse.data);

        // get stand-up topics
        const standupTopicsResponse = await Axios.get<IStandupTopic[]>(`https://${process.env.PUBLIC_HOSTNAME}/api/standupagenda/standup-topics/${meetingId}`, authHeader);
        setStandupTopics(standupTopicsResponse.data);
      }
    })();
  }, [meetingId, accessToken]);

  const saveStandupTopics = async (topics: IStandupTopic[]): Promise<void> => {
    const response = await Axios.post(`https://${process.env.PUBLIC_HOSTNAME}/api/standupagenda/standup-topics/${meetingId}`, topics, { headers: { Authorization: `Bearer ${accessToken}` } });
    setStandupTopics(response.data);
  }

  const onNewStandupTopicSubmit = (): void => {
    const newTopics = standupTopics;

    let newStandUpTopic: IStandupTopic = {
      id: `${currentUserId}-${Date.now()}`,
      presenter: {
        id: currentUserId,
        name: currentUserName
      },
      title: newTopicTitle as string,
      approved: false,
      presented: false
    };

    newTopics.push(newStandUpTopic);
    setNewTopicTitle("");

    // save changes
    (async () => { await saveStandupTopics(newTopics); })();
  };

  const toggleStandupTopicStatus = (targetTopicId: string): void => {
    // get all topics except current one
    let updatedTopics = standupTopics.filter((topic) => { return topic.id !== targetTopicId });

    // find existing topic
    let currentTopic = standupTopics.filter((topic) => { return topic.id === targetTopicId })[0];
    currentTopic.approved = !currentTopic.approved;

    // add updated topic back to collection
    updatedTopics.push(currentTopic);

    // save changes
    (async () => { await saveStandupTopics(updatedTopics); })();
  };

  const togglePresentedState = (topicId: string): void => {
    let updatedTopics = standupTopics.filter((topic) => { return topic.id !== topicId });

    // find existing topic
    let currentTopic = standupTopics.filter((topic) => { return topic.id === topicId })[0];
    currentTopic.presented = !currentTopic.presented;

    updatedTopics.push(currentTopic);

    // save changes
    (async () => { await saveStandupTopics(updatedTopics); })();
  }

  const getPreMeetingUX = () => {
    let gridSpan = { gridColumn: "span 4" };

    let addTopicForm: JSX.Element | null = null;

    if (showAddTopicForm) {
      gridSpan = { gridColumn: "span 3" };
      addTopicForm = <Provider theme={theme}>
        <Box styles={{ gridColumn: "span 1" }}>
          <Flex fill={true} column styles={{ paddingLeft: "1.6rem", paddingRight: "1.6rem" }}>
            <Header content="Add standup topic" />
            <Form styles={{ justifyContent: "initial" }}
              onSubmit={onNewStandupTopicSubmit}>
              <FormInput label="Topic"
                name="topic"
                id="topic"
                required
                value={newTopicTitle}
                onChange={(e, i) => { setNewTopicTitle(i?.value); }}
                showSuccessIndicator={false} />
              <FormButton content="Submit" primary />
            </Form>
            <Flex.Item push>
              <Button content="Close" secondary onClick={() => { setShowAddTopicForm(false); }}
                style={{ marginLeft: "auto", marginRight: "auto", marginTop: "2rem", width: "12rem" }} />
            </Flex.Item>
          </Flex>
        </Box>
      </Provider>
    }

    const rows = standupTopics.map(standupTopic => (
      {
        id: standupTopic.id,
        topic: standupTopic.title,
        presenter: standupTopic.presenter.name,
        status: (standupTopic.approved) ? 'approved' : 'pending',
        actions: {
          toggleStatus: {
            title: (standupTopic.approved) ? 'Reject' : 'Approve'
          }
        }

      })

    ).reduce((prevValue, currValue, index, array) => (
      {
        ...prevValue,
        [currValue.id]: currValue
      }),
      {}
    );



    let addTopicAction = { g1: { addTopic: { title: "Add stand-up topic" } } };

    // TODO: getPreMeetingUX

    return (
      <Grid columns="repeat(4, 1fr)" styles={{ gap: "20px" }}>
        <Box styles={gridSpan}>
          <Flex fill={true} column>
            <List
              label="Standup Meeting Topics"
              selectable={currentUserIsOrganizer}
              columns={{
                presenter: { title: "Presenter" },
                topic: { title: "Topic" },
                status: { title: "Status" }
              }}
              rows={rows}
              onInteraction={async (interaction: TListInteraction) => {
                if (interaction.target === "toolbar") {
                  const toolbarInteraction = interaction as TToolbarInteraction;
                  switch (toolbarInteraction.action) {
                    case "addTopic":
                      setShowAddTopicForm(true);
                      break;
                    case "toggleStatus":
                      toggleStandupTopicStatus((toolbarInteraction.subject as string[])[0]);
                      break;
                  }
                }
              }}
              emptyState={{
                fields: {
                  title: "Create your first standup meeting topic",
                  desc: "Add your first proposed topic to cover during the stand up meeting by selecting 'Add topic' in the header of this list"
                },
                option: CommunicationOptions.Empty
              }}
              emptySelectionActionGroups={addTopicAction} />
          </Flex>
        </Box>
        {addTopicForm}
      </Grid>
    )
  };

  const getSidepanelUX = () => {
    const filteredTopics = standupTopics.filter((topic) => {
      return (currentUserIsOrganizer)
        ? (topic.approved === true)
        : ((topic.approved === true) && (topic.presenter.id === currentUserId));
    });
    const sortedTopics = sortBy(filteredTopics, [topic => topic.presenter.name, topic => topic.title]);

    return (
      <Flex fill={true} column styles={{ gap: "10px" }}>
        <Text content="Check the stand up topics that have been presented during this meeting" />
        {
          sortedTopics.map(topic => (
            <Card>
              <Card.Header>
                <Text content={topic.title} weight="bold" />
                <Text content={`By ${topic.presenter.name}`} temporary />
              </Card.Header>
              <Card.Footer>
                <Checkbox toggle
                  label="Presented"
                  checked={topic.presented}
                  disabled={!(setCurrentUserIsOrganizer || topic.presenter.id !== currentUserId)}
                  onChange={(e, v) => {
                    togglePresentedState(topic.id);
                  }} />
              </Card.Footer>
            </Card>
          ))
        }
      </Flex>
    )
  }

  const getMeetingStageUX = () => {
    const presenters = Object.values(
      standupTopics.filter((topic) => { return topic.approved; })
        .reduce(
          (result, standupTopic) => {
            // create presenter if !exist
            if (!result[standupTopic.presenter.name]) {
              result[standupTopic.presenter.name] = {
                presenter: standupTopic.presenter.name,
                topics: []
              };
            }

            // add topic to presenter
            result[standupTopic.presenter.name].topics.push({
              title: standupTopic.title,
              approved: standupTopic.approved,
              presented: standupTopic.presented
            });

            return result;
          }, {}
        )
    );

    return (
      <Grid columns="3" styles={{ margin: "20px", gap: "20px" }}>
        {
          sortBy(presenters, [(p: any) => p.presenter]).map(presenter => (
            <div>
              <Text content={presenter.presenter} weight="semibold" size="larger" />
              <Flex column styles={{ gap: "10px" }}>
                {
                  orderBy(presenter.topics,
                    ["presented", "title"],
                    ["desc", "asc"]
                  )
                    .map(
                      (topic: any) => (
                        <Card>
                          <Text content={topic.title} size="large" />
                          {topic.presented &&
                            <Pill styles={{ background: "#E7F2DA" }}>Presented</Pill>
                          }
                        </Card>
                      )
                    )
                }
              </Flex>
            </div>
          ))
        }
      </Grid>
    );
  }

  /**
   * The render() method to create the UI of the tab
   */
  let mainContentElement: JSX.Element | JSX.Element[] | null = null;
  switch (frameContext) {
    case FrameContexts.content:
    if (onlineMeeting.startDateTime) {
      mainContentElement = ((new Date(onlineMeeting.startDateTime as string)).getTime() < Date.now())
        ? getMeetingStageUX()
        : getPreMeetingUX();
    }
    break;
    case FrameContexts.sidePanel:
      mainContentElement = getSidepanelUX();
      break;
    case FrameContexts.meetingStage:
      mainContentElement = getMeetingStageUX();
      break;
    default:
      mainContentElement = null;
  }

  return (
    <Provider theme={theme}>
      <RTProvider themeName={TeamsTheme[themeString.charAt(0).toUpperCase() + themeString.slice(1)]} lang="en-US">
        {mainContentElement}
      </RTProvider>
    </Provider>
  );
};
