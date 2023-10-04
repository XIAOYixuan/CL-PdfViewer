import { Document, Page } from 'react-pdf/dist/esm/entry.vite';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import React, { useEffect, useRef, useState } from 'react';
import eventEmitter from '../../utils/eventEmitter';
import PageSpin from '../pageSpin';

export default function PdfViewer({ file, onTextSelect }: { file: Blob, onTextSelect: (selectedText: string) => void }) {
  const [numPages, setNumPages] = useState<number>();
  const [showContextMenu, setShowContextMenu] = useState<boolean>(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState<string>('');
  const pdfRef = useRef<HTMLDivElement>(null);

  function scrollToPage(meta: { pageNo: number; time: number }) {
    const { pageNo, time } = meta;

    setTimeout(() => {
      if (pdfRef?.current) {
        pdfRef.current?.children[pageNo - 1].scrollIntoView();
      }
    }, time);
  }

  useEffect(() => {
    eventEmitter.on('scrollToPage', scrollToPage);

    return () => {
      eventEmitter.off('scrollToPage', scrollToPage);
    };
  }, []);

  function onDocumentLoadSuccess({ numPages: nextNumPages }: PDFDocumentProxy) {
    setNumPages(nextNumPages);
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setSelectedText(window.getSelection()?.toString() || '');
    setShowContextMenu(true);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  }
  // five main functions:
  // func: explain selected text with examples
  // func: simply selected text
  // func: detect jargon
  // func: exemplify jargon
  function onExplainClick() {
    //alert(selectedText);
    onTextSelect("::explain::" + selectedText);
    setShowContextMenu(false);
  }
  
  function onSimplifyClick() {
    //alert(selectedText);
    onTextSelect("::simplify::" + selectedText);
    setShowContextMenu(false);
  }
  
  function onDetectClick() {
    //alert(selectedText);
    onTextSelect("::detect::" + selectedText);
    setShowContextMenu(false);
  }
  
  function onExemplifyClick() {
    //alert(selectedText);
    onTextSelect("::eg::" + selectedText);
    setShowContextMenu(false);
  }
  
  function onAddChatClick() {
    //alert(selectedText);
    onTextSelect(selectedText);
    setShowContextMenu(false);
  }

  return (
    <Document
      inputRef={pdfRef}
      loading={<PageSpin />}
      className="w-[700px] bg-white h-full overflow-auto relative scroll-smooth rounded-lg shadow-md"
      file={file}
      onLoadSuccess={onDocumentLoadSuccess}
      options={{
        cMapUrl: 'cmaps/',
        standardFontDataUrl: 'standard_fonts/'
      }}
    >
      {Array.from(new Array(numPages), (_el, index) => (
        <div key={`page_${index + 1}`} onContextMenu={onContextMenu}>
        <Page 
          width={690} 
          key={`page_${index + 1}`} 
          pageNumber={index + 1} />
        </div>
      ))}
      {showContextMenu && (
        <div style={{ 
          position: 'fixed', 
          top: contextMenuPosition.y, 
          left: contextMenuPosition.x,
          display: 'flex',
          flexDirection: 'column' }}>
          <button onClick={onExplainClick}>Explain text</button>
          <button onClick={onExemplifyClick}>Show an example</button>
          <button onClick={onDetectClick}>Detect jargons</button>
          <button onClick={onSimplifyClick}>Simplify text</button>
          <button onClick={onAddChatClick}>Add to chat</button>
        </div>
      )}
    </Document>
  );
}
