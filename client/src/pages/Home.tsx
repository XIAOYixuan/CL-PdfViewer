import { Empty } from 'antd';
import { useContext, useEffect, useState } from 'react';
import ChatWindow from '../components/chatWindow';
import request from '../utils/request';
import eventEmitter from '../utils/eventEmitter';
import PdfViewer from '../components/pdfViewer';
import { isEmpty, has } from 'lodash';
import FileItem from '../constants/fileItem';
import { CurrentFileContext } from '../context/currentFile';
import isPdf from '../utils/isPdf';
import HtmlViewer from '../components/htmlViewer';

async function downloadFile(fileItem: FileItem) {
  let res;
  if (isPdf(fileItem.ext)) {
    res = await request(fileItem.path, {
      responseType: 'blob'
    });
  } else {
    res = await request(fileItem.path);
  }

  return res.data;
}

const Home = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const currentFile = useContext(CurrentFileContext);

  useEffect(() => {
    eventEmitter.emit('cleanChat');

    getFile();
  }, [currentFile]);

  async function getFile() {
    if (currentFile) {
      setLoading(true);
      const file = await downloadFile(currentFile);
      setLoading(false);

      setFile(file);
    }
  }

  function handleHighLight(item: any, time = 400) {
    // we won't highlight srcs cuz we don't use the index mdl
    return;
  }

  return (
    <div className="w-full flex">
      <div className="flex h-full overflow-auto flex-1 justify-center py-3">
        {file ? (
          <>
            {isPdf(currentFile?.ext || '') ? (
              <PdfViewer file={file} onTextSelect={setSelectedText}/>
            ) : (
              <HtmlViewer html={file} loading={loading} />
            )}
          </>
        ) : (
          <Empty
            className="mt-24"
            image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg"
            imageStyle={{ height: 60 }}
            description={<span>No uploaded file.</span>}
          />
        )}
      </div>

      <ChatWindow
        fullFileName={currentFile?.fullName || ''}
        fileName={currentFile?.name.split(currentFile.ext)[0] || ''}
        className="flex flex-col"
        onReplyComplete={handleHighLight}
        onSourceClick={(item) => handleHighLight(item, 0)}
        selectedText = {selectedText}
      />
    </div>
  );
};

export default Home;
