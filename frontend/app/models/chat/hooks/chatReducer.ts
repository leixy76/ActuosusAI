import { useReducer } from 'react';
import MessageTrie from '@/app/models/chat/utils/MessageTrie';

export type WordProbList = [string, number][];
export enum WordStatus {
  PREVIOUS = 2,
  PICKED = 3,
}
export type Message = {
  content: (WordProbList | string)[];
  source: string;
};

export type baseChatState = {
  messages: Message[];
  inputMessage: string;
  openedWord_i: number;
  openedWord_j: number;
  ai_model_name: string;
  estimated_ram: number;
  estimated_vram: number;
  temperature: number;
  maxNewTokens: number;
  minProb: number;
  maxContextLength: number;
  trie: MessageTrie;
  showContinueGenerate: boolean;
  showHeatMap: boolean;
  isGenerating: boolean;
};

const initialState: baseChatState = {
  messages: [],
  inputMessage: '',
  openedWord_i: -1,
  openedWord_j: -1,
  ai_model_name: '',
  estimated_ram: 0,
  estimated_vram: 0,
  temperature: 1,
  maxNewTokens: 100,
  minProb: 0.01,
  maxContextLength: 8192,
  trie: new MessageTrie(),
  showContinueGenerate: false,
  showHeatMap: false,
  isGenerating: false,
};

export type baseChatAction =
  | {
      type: 'APPEND_TO_LAST_MESSAGE';
      payload: {
        source: string;
        content: string | WordProbList;
      };
    }
  | {
      type: 'SELECT_NEW_WORD_AT';
      i: number;
      j: number;
      prevWord: string;
      newWord: string;
    }
  | {
      type: 'RESET_AND_SEND_NEW_MESSAGE';
      content: string;
      source: string;
    }
  | {
      type: 'SEND_NEW_MESSAGE';
      content: string;
      source: string;
    }
  | {
      type: 'REFRESH_WORD_AT';
      payload: {
        i: number;
        j: number;
        content: WordProbList;
      };
    }
  | {
      type: 'SET_MESSAGES';
      messages: Message[];
    }
  | {
      type: 'SET_INPUT_MESSAGE';
      inputMessage: string;
    }
  | {
      type: 'SET_OPENED_WORD';
      i: number;
      j: number;
    }
  | {
      type: 'SET_MODEL_INFO';
      payload: {
        max_length: number;
        temperature: number;
        max_new_tokens: number;
        ai_model_name: string;
        estimated_ram: number;
        estimated_vram: number;
      };
    }
  | {
      type: 'SET_TEMPERATURE';
      temperature: number;
    }
  | {
      type: 'SET_MAX_NEW_TOKENS';
      maxNewTokens: number;
    }
  | {
      type: 'SET_MIN_PROB';
      minProb: number;
    }
  | {
      type: 'MESSAGE_END';
      payload: boolean; // true if the message ends with eos token
    }
  | {
      type: 'TOGGLE_HEATMAP';
    }
  | { type: 'SET_IS_GENERATING'; isGenerating: boolean };

const reducer = (
  state: baseChatState,
  action: baseChatAction
): baseChatState => {
  switch (action.type) {
    case 'APPEND_TO_LAST_MESSAGE':
      return {
        ...state,
        messages: appendToLastMessage(
          state.messages,
          action.payload.source,
          action.payload.content
        ),
        showContinueGenerate: false,
      };
    case 'SELECT_NEW_WORD_AT':
      const newMessage = copyObject(state.messages[action.i]);
      newMessage.content = [
        ...newMessage.content.slice(0, action.j),
        [
          [action.newWord, WordStatus.PICKED],
          [action.prevWord, WordStatus.PREVIOUS],
        ],
      ];
      return {
        ...state,
        openedWord_i: -1,
        openedWord_j: -1,
        messages: [...state.messages.slice(0, action.i), newMessage],
        showContinueGenerate: false,
        isGenerating: true,
      };
    case 'REFRESH_WORD_AT':
      return {
        ...state,
        messages: refreshWordAt(
          state.messages,
          action.payload.i,
          action.payload.j,
          action.payload.content
        ),
      };
    case 'RESET_AND_SEND_NEW_MESSAGE':
      return {
        ...state,
        messages: appendToLastMessage([], action.source, action.content),
        openedWord_i: -1,
        openedWord_j: -1,
        inputMessage: '',
        showContinueGenerate: false,
        isGenerating: true,
      };
    case 'SEND_NEW_MESSAGE':
      return {
        ...state,
        messages: appendToLastMessage(
          state.messages,
          action.source,
          action.content
        ),
        openedWord_i: -1,
        openedWord_j: -1,
        inputMessage: '',
        showContinueGenerate: false,
        isGenerating: true,
      };
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: action.messages,
        openedWord_i: -1,
        openedWord_j: -1,
        showContinueGenerate: false,
      };
    case 'SET_INPUT_MESSAGE':
      return {
        ...state,
        inputMessage: action.inputMessage,
      };
    case 'SET_OPENED_WORD':
      return {
        ...state,
        openedWord_i: action.i,
        openedWord_j: action.j,
      };
    case 'SET_MODEL_INFO':
      return {
        ...state,
        ai_model_name: action.payload.ai_model_name,
        estimated_ram: action.payload.estimated_ram,
        estimated_vram: action.payload.estimated_vram,
        maxContextLength: action.payload.max_length,
        maxNewTokens: action.payload.max_new_tokens,
        temperature: action.payload.temperature,
      };
    case 'SET_TEMPERATURE':
      return {
        ...state,
        temperature: action.temperature,
      };
    case 'SET_MAX_NEW_TOKENS':
      return {
        ...state,
        maxNewTokens: action.maxNewTokens,
      };
    case 'SET_MIN_PROB':
      return {
        ...state,
        minProb: action.minProb,
      };
    case 'MESSAGE_END':
      const newTrie = MessageTrie.deserialize(state.trie.serialize());
      newTrie.insert(state.messages);
      return {
        ...state,
        trie: newTrie,
        isGenerating: false,
        showContinueGenerate: !action.payload,
      };
    case 'TOGGLE_HEATMAP':
      return {
        ...state,
        showHeatMap: !state.showHeatMap,
      };
    case 'SET_IS_GENERATING':
      return {
        ...state,
        isGenerating: action.isGenerating,
      };
    default:
      return state;
  }
};
const copyObject = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

const appendToLastMessage = (
  messages: Message[],
  source: string,
  content: string | WordProbList
): Message[] => {
  if (messages[messages.length - 1]?.source === source) {
    const lastMessage = copyObject(messages[messages.length - 1]);
    lastMessage.content.push(content);
    return [...messages.slice(0, -1), lastMessage];
  } else {
    return [...messages, { content: [content], source }];
  }
};
function refreshWordAt(
  messages: Message[],
  i: number,
  j: number,
  wordProbList: WordProbList
): Message[] {
  const newMessage = copyObject(messages[i]);
  newMessage.content[j] = [
    newMessage.content[j][0],
    ...wordProbList.filter(
      (wordProb) => wordProb[0] !== newMessage.content[j][0]
    ),
  ] as WordProbList;
  return [...messages.slice(0, i), newMessage, ...messages.slice(i + 1)];
}

const useChatReducer = () => useReducer(reducer, initialState);

export default useChatReducer;
