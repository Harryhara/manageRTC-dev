/**
 * Attachment Upload Component
 * Handles file uploads for leave requests
 */

import { useState } from 'react';
import { Upload, Button, message, List, Space, Popconfirm, Modal } from 'antd';
import { UploadOutlined, DeleteOutlined, FileOutlined, EyeOutlined } from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';

export interface Attachment {
  _id?: string;
  attachmentId?: string;
  filename: string;
  originalName: string;
  url: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
}

interface AttachmentUploadProps {
  leaveId?: string;
  attachments?: Attachment[];
  onUploadComplete?: (attachment: Attachment) => void;
  onDeleteComplete?: (attachmentId: string) => void;
  readonly?: boolean;
  maxCount?: number;
}

export const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
  leaveId,
  attachments = [],
  onUploadComplete,
  onDeleteComplete,
  readonly = false,
  maxCount = 5
}) => {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>(
    attachments.map(att => ({
      uid: att.attachmentId || att._id || att.filename,
      name: att.originalName,
      status: 'done' as const,
      url: att.url,
      response: att
    }))
  );

  const uploadProps: UploadProps = {
    name: 'attachment',
    action: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/leaves/${leaveId}/attachments`,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    accept: '.pdf,.jpg,.jpeg,.png',
    maxCount,
    fileList,
    beforeUpload: (file) => {
      const isValidType = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
        .includes(file.type);
      if (!isValidType) {
        message.error('Only PDF and images (JPEG, PNG) are allowed');
        return false;
      }
      const isValidSize = file.size / 1024 / 1024 < 5;
      if (!isValidSize) {
        message.error('File must be smaller than 5MB');
        return false;
      }
      return true;
    },
    onChange: (info) => {
      setFileList(info.fileList);

      if (info.file.status === 'uploading') {
        setUploading(true);
      }
      if (info.file.status === 'done') {
        setUploading(false);
        message.success('File uploaded successfully');
        onUploadComplete?.(info.file.response);
      } else if (info.file.status === 'error') {
        setUploading(false);
        message.error('Upload failed');
      }
    },
    disabled: readonly || uploading,
    onRemove: readonly ? () => false : undefined
  };

  const handleDelete = async (attachment: Attachment) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/leaves/${leaveId}/attachments/${attachment.attachmentId || attachment._id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.ok) {
        message.success('Attachment deleted');
        onDeleteComplete?.(attachment.attachmentId || attachment._id || '');
      } else {
        throw new Error('Failed to delete attachment');
      }
    } catch (error) {
      message.error('Failed to delete attachment');
    }
  };

  const handlePreview = (attachment: Attachment) => {
    const url = attachment.url.startsWith('http')
      ? attachment.url
      : `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}${attachment.url}`;

    window.open(url, '_blank');
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {!readonly && leaveId && (
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} loading={uploading} disabled={fileList.length >= maxCount}>
            Upload Attachment {fileList.length > 0 && `(${fileList.length}/${maxCount})`}
          </Button>
        </Upload>
      )}

      {attachments.length > 0 && (
        <List
          size="small"
          dataSource={attachments}
          renderItem={(item) => (
            <List.Item
              actions={
                !readonly ? [
                  <Button
                    key="preview"
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handlePreview(item)}
                  >
                    View
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="Delete this attachment?"
                    onConfirm={() => handleDelete(item)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                ] : [
                  <Button
                    key="preview"
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handlePreview(item)}
                  >
                    View
                  </Button>
                ]
              }
            >
              <List.Item.Meta
                avatar={<FileOutlined style={{ fontSize: 20 }} />}
                title={
                  <span style={{ wordBreak: 'break-all' }}>
                    {item.originalName}
                  </span>
                }
                description={
                  <span>
                    {item.size && `${(item.size / 1024).toFixed(1)} KB`}
                    {item.uploadedAt && ` • Uploaded: ${new Date(item.uploadedAt).toLocaleDateString()}`}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Space>
  );
};

export default AttachmentUpload;
