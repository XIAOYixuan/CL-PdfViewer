import { ProfileOutlined, SendOutlined, WarningTwoTone } from '@ant-design/icons';
import { Button, Card, Input, message, Popconfirm, Tooltip } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { FC, Fragment, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import eventEmitter from '../../utils/eventEmitter';
import fetchRequest from '../../utils/fetch';
import useOpenAiKey from '../../utils/useOpenAiKey';
import loadUserMajor from '../../utils/loadUserMajor';
import { MessageItem } from './constants';
import Message from './Message';

interface ChatWindowProps {
  fileName: string;
  fullFileName: string;
  className?: string;
  onReplyComplete: (data: any) => void;
  onSourceClick: (data: any) => void;
  selectedText: string;
}

const ChatWindow: FC<ChatWindowProps> = ({
  fileName,
  fullFileName,
  className,
  onReplyComplete,
  onSourceClick,
  selectedText,
}) => {
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [messageList, setMessageList] = useState<MessageItem[]>([]);
  const openAiKey = useOpenAiKey();
  const userMajor = loadUserMajor();
  //console.log("userMajor: " + userMajor);
  function cleanChat() {
    setMessageList([]);
  }

  useEffect(() => {
    eventEmitter.on('cleanChat', cleanChat);

    return () => {
      eventEmitter.off('cleanChat', cleanChat);
    };
  }, [])
  
  useEffect(() => {
    if (selectedText !== '') {
      setQuery(selectedText);
    }
  }, [selectedText]);

  useLayoutEffect(() => {
    requestAnimationFrame(() => scrollToBottom());
  }, [messageList]);

  const scrollToBottom = () => {
    const chatWindow = chatWindowRef.current;
    chatWindow && (chatWindow.scrollTop = chatWindow?.scrollHeight || 0);
  };

  const updateMessageList = (message: string) => {
    setMessageList((pre) => {
      return [
        ...pre.slice(0, -1),
        {
          ...pre.slice(-1)[0],
          reply: pre.slice(-1)[0].reply + message
        }
      ];
    });
  };

  const onReply = async (value: string, summarize = false) => {
    try {
      let res: Response;
      setLoading(true);

      if (summarize) {
        res = await fetchRequest('/api/summarize', {
          file: fullFileName,
          openAiKey
        });
      } else {
        res = await fetchRequest('/api/query', {
          query: value,
          index: fileName,
          openAiKey,
          userMajor
        });
      }

      setLoading(false);

      const reader = res?.body?.getReader() as ReadableStreamDefaultReader;

      const decoder = new TextDecoder();
      let done = false;
      let metaData: any;

      while (!done) {
        const { value, done: doneReading } = await reader.read();

        done = doneReading;
        const chunkValue = decoder.decode(value);
        const hasMeta = chunkValue.includes('\n ###endjson### \n\n');
        if (hasMeta) {
          const [metaDataStr, message] = chunkValue.split('\n ###endjson### \n\n');
          metaData = JSON.parse(metaDataStr);

          updateMessageList(message.trim());
        } else {
          updateMessageList(chunkValue);
        }
      }

      setMessageList((pre) => {
        return [
          ...pre.slice(0, -1),
          {
            ...pre.slice(-1)[0],
            cost: metaData.cost,
            sources: metaData.sources
          }
        ];
      });

      onReplyComplete({ ...metaData?.sources[0] });
    } catch (error) {
      setLoading(false);
      setMessageList((pre) => {
        return [
          ...pre.slice(0, -1),
          {
            ...pre.slice(-1),
            reply: (
              <>
                <WarningTwoTone /> please retry
              </>
            ),
            error: true
          }
        ];
      });
      console.log(error);
    }
  };

  const onSearch = async () => {
    if (!openAiKey) {
      message.error('Please set your openAI key');
      return;
    }
    
    if (!userMajor) {
      message.error('Please enter your major');
      return;
    }

    setQuery('');
    setMessageList([...messageList, { question: query }, { reply: '' }]);
    onReply(query);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.shiftKey) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      // send the msg to api and query
      onSearch();
    }
  };

  return (
    <Card
      style={{ width: 390 }}
      className={classNames(className, 'rounded-none')}
      bodyStyle={{
        flex: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0'
      }}
      title={fileName ? `Chat with ${fileName}` : 'Select File'}
      bordered={false}
    >
      <div ref={chatWindowRef} className="flex flex-col items-start flex-1 overflow-auto px-6">
        {messageList.map((item, index) => (
          <Fragment key={index}>
            {item.question ? (
              <Message isQuestion text={item.question} />
            ) : (
              <Message
                loading={loading && index === messageList.length - 1}
                item={item}
                text={item.reply || ''}
                onSourceClick={onSourceClick}
                error={item.error}
              />
            )}
          </Fragment>
        ))}
      </div>

      <div className="p-4 pb-0 border-t border-t-gray-200 border-solid border-x-0 border-b-0">
        <div className="relative">
          <Input.TextArea
            disabled={loading || !openAiKey || !userMajor}
            size="large"
            placeholder={openAiKey && userMajor? 'Input your question' : 'Configure your OpenAI key and major first'}
            value={query}
            className="pr-[36px]"
            onKeyDown={onKeyDown}
            autoSize
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button
            style={{ width: 32 }}
            size="small"
            type="text"
            className="absolute right-1 top-2"
            icon={<SendOutlined style={{ color: '#3f95ff' }} />}
            onClick={onSearch}
          ></Button>
        </div>
      </div>
    </Card>
  );
};

export default ChatWindow;
