export class DateUtils {
    private timezone: string;
    private static readonly DISCORD_EPOCH: bigint = 1420070400000n; // Discord epoch (2015-01-01T00:00:00.000Z)

    constructor() {
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    formatDate(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                throw new Error('Invalid date');
            }

            return date.toLocaleString('en-US', {
                timeZone: this.timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid Date';
        }
    }

    dateToLocalString(date: Date): string {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            console.warn('Invalid date provided to dateToLocalString:', date);
            return '';
        }

        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');

            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (error) {
            console.error('Error converting date to local string:', error);
            return '';
        }
    }

    localStringToUTC(dateString: string): Date | null {
        if (!dateString) {
            console.warn('Empty date string provided to localStringToUTC');
            return null;
        }

        try {
            const localDate = new Date(dateString);

            if (isNaN(localDate.getTime())) {
                throw new Error('Invalid date string');
            }

            return localDate;
        } catch (error) {
            console.error('Error converting local string to UTC:', error);
            return null;
        }
    }

    dateToDiscordSnowflake(date: Date | string): string | null {
        if (!date) {
            console.warn('No date provided to dateToDiscordSnowflake');
            return null;
        }

        try {
            const timestamp = BigInt(date instanceof Date ? date.getTime() : new Date(date).getTime());
            const snowflake = ((timestamp - DateUtils.DISCORD_EPOCH) << 22n).toString();

            // Verify the snowflake by converting back to a date
            const verificationDate = this.snowflakeToDate(snowflake);
            if (!verificationDate) {
                throw new Error('Verification failed for snowflake');
            }

            return snowflake;
        } catch (error) {
            console.error('Error generating Discord snowflake:', error);
            return null;
        }
    }

    snowflakeToDate(snowflake: string): Date | null {
        if (!snowflake) {
            console.warn('No snowflake provided to snowflakeToDate');
            return null;
        }

        try {
            // Extract timestamp bits and convert back to milliseconds
            const timestamp = (BigInt(snowflake) >> 22n) + DateUtils.DISCORD_EPOCH;
            const date = new Date(Number(timestamp));

            if (isNaN(date.getTime())) {
                throw new Error('Invalid date from snowflake');
            }

            return date;
        } catch (error) {
            console.error('Error converting snowflake to date:', error);
            return null;
        }
    }

    isValidDate(date: Date | string): boolean {
        try {
            const dateObj = date instanceof Date ? date : new Date(date);
            return !isNaN(dateObj.getTime());
        } catch {
            return false;
        }
    }
}
