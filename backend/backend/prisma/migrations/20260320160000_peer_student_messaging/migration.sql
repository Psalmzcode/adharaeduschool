-- CreateTable
CREATE TABLE "peer_conversations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userLowerId" TEXT NOT NULL,
    "userHigherId" TEXT NOT NULL,
    "lastMessage" TEXT,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peer_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peer_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peer_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "peer_conversations_userLowerId_userHigherId_key" ON "peer_conversations"("userLowerId", "userHigherId");

-- AddForeignKey
ALTER TABLE "peer_conversations" ADD CONSTRAINT "peer_conversations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_messages" ADD CONSTRAINT "peer_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "peer_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_messages" ADD CONSTRAINT "peer_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
