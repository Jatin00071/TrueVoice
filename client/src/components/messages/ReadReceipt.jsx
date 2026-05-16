function ReadReceipt({ read, mine }) {
  if (!mine) return null;
  return <span aria-label={read ? 'Read' : 'Delivered'}>{read ? 'Read' : 'Sent'}</span>;
}
export default ReadReceipt;
