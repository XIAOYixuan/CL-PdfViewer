import { Alert, Button, Divider, Space, Menu, Dropdown } from 'antd';
import FileItem from '../../constants/fileItem';
import FileCard from '../fileCard';
import FileUpload from '../upload';
import { GithubOutlined, SettingOutlined } from '@ant-design/icons';
import fetchRequest from '../../utils/fetch';
import request from '../../utils/request';
import eventEmitter from '../../utils/eventEmitter';

interface SideMenuProps {
  fileList: FileItem[];
  activeFile: string;
  onFileClick: (item: FileItem) => void;
  onOpenSetting: () => void;
}

const disableUpload = import.meta.env.VITE_DISABLED_UPLOAD;

const handleFileDeletion = async (item: FileItem) => {
  try {
    console.log("delete file: " + item.name);
    const res = await request(`/api/delete?file=${item.name}`, {
      method: 'GET',
    });
    eventEmitter.emit('refreshFileList');

  } catch (error) {
    console.log('Failed to delete file:', error);
  }
};

export default function SideMenu({
  fileList,
  onFileClick,
  activeFile,
  onOpenSetting
}: SideMenuProps) {
  return (
    <div className="flex flex-col w-[250px] h-full  bg-white py-4 px-2 justify-between">
      <div className="flex-1 overflow-auto">
        {fileList.map((item)   => (
          <div key={item.name}>
          <FileCard
            item={item}
            active={activeFile === item.name}
            onClick={() => onFileClick(item)}
            onRightClick={handleFileDeletion}
          />
          </div>
        ))}
      </div>

      <Divider />

      {disableUpload ? (
        <Alert
          type="warning"
          description={
            <>
              The upload is not available on the current website. You can
              <a href="https://github.com/XIAOYixuan/CL-PdfViewer" target="__blank">
                {' '}
                fork and clone the project{' '}
              </a>
              to your local device to complete the upload.
            </>
          }
        />
      ) : (
        <FileUpload />
      )}

      <div className="mt-2 flex justify-between items-center">
        <span className="text-xs text-gray-500">CL PdfViewer</span>

        <Space>
          <Button
            href="https://github.com/XIAOYixuan/CL-PdfViewer"
            target="__blank"
            icon={<GithubOutlined />}
          ></Button>
          <Button icon={<SettingOutlined />} onClick={onOpenSetting}></Button>
        </Space>
      </div>
    </div>
  );
}
