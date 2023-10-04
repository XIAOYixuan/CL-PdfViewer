import { FilePdfTwoTone, FileTextTwoTone } from '@ant-design/icons';
import { Card, Space } from 'antd';
import classNames from 'classnames';
import { MouseEventHandler, useState } from 'react';
import FileItem from '../../constants/fileItem';
import isPdf from '../../utils/isPdf';

interface FileCardProps {
  item: FileItem;
  onClick: MouseEventHandler<HTMLDivElement>;
  active?: boolean;
  onRightClick: (item: FileItem) => void;
}

export default function FileCard({ item, active, onClick, onRightClick }: FileCardProps) {
  const [contextMenuPos, setContextMenuPos] = useState<{x: number, y: number} | null>(null);

  const handleRightClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuPos({ x: event.clientX, y: event.clientY });
  };

  const closeContextMenu = () => {
    onRightClick(item);
    console.log("right click");
    setContextMenuPos(null);
  };

  return (
    <Card
      bodyStyle={{ padding: '12px 10px' }}
      className={classNames('p-0 text-sm mb-3 cursor-pointer hover:border-blue-500', {
        ['border-blue-50 bg-card-blue']: active
      })}
      onClick={onClick}
      onContextMenu={handleRightClick}
    >
      <Space className="flex items-start">
        {isPdf(item.ext) ? <FilePdfTwoTone twoToneColor="#e94847" /> : <FileTextTwoTone />}
        <div>{item.name.split(item.ext)}</div>
      </Space>
      {contextMenuPos && (
        <div 
          style={{ 
            position: 'fixed', 
            top: contextMenuPos.y, 
            left: contextMenuPos.x,
            backgroundColor: 'white',
            border: '1px solid black'
          }}
          onClick={closeContextMenu}
        >
          Delete
        </div>
      )}
    </Card>
  );
}
